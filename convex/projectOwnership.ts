import { assertProjectSnapshotWritable } from './lib/projectSnapshotLock'
import { hasUnanimousApproval } from '@track/shared/company'
import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireAuthenticatedActor } from './lib/actorContext'
import {
  requireCompanyAdmin,
  requireCompanyProjectManager,
} from './lib/companyPolicy'

type OwnershipCtx = MutationCtx | QueryCtx
type OwnershipActor = Parameters<typeof requireCompanyProjectManager>[1]

async function requireOwnershipAuthority(
  ctx: OwnershipCtx,
  actor: OwnershipActor,
  input: {
    projectId: Id<'projects'>
    actingCompanyId: Id<'companies'>
    projectMemberId: Id<'projectMembers'>
  },
) {
  await requireCompanyAdmin(ctx, actor, input.actingCompanyId)
  return await requireCompanyProjectManager(ctx, actor, input)
}

async function getActiveParticipants(ctx: OwnershipCtx, projectId: Id<'projects'>) {
  return await ctx.db
    .query('projectCompanies')
    .withIndex('by_project_status', (q) => q.eq('projectId', projectId).eq('status', 'active'))
    .collect()
}

async function assignOwnership(
  ctx: MutationCtx,
  input: {
    project: Doc<'projects'>
    request: Doc<'projectOwnershipRequests'>
    actorId: Id<'users'>
    actingCompanyId: Id<'companies'>
  },
) {
  const now = Date.now()
  await ctx.db.patch(input.project._id, {
    owningCompanyId: input.request.proposedOwningCompanyId,
    revision: (input.project.revision ?? 0) + 1,
    updatedAt: now,
  })
  await ctx.db.patch(input.request._id, {
    status: 'approved',
    decidedAt: now,
    updatedAt: now,
  })
  await appendAuditEvent(ctx, {
    companyId: input.request.proposedOwningCompanyId,
    projectId: input.project._id,
    actorId: input.actorId,
    actingCompanyId: input.actingCompanyId,
    entityType: 'project',
    entityId: input.project._id,
    action: 'project_ownership.assigned',
    after: { owningCompanyId: input.request.proposedOwningCompanyId },
  })
}

export const getState = query({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    await requireOwnershipAuthority(ctx, actor, args)
    const [request, projectCompanies] = await Promise.all([
      ctx.db
        .query('projectOwnershipRequests')
        .withIndex('by_project_status', (q) =>
          q.eq('projectId', args.projectId).eq('status', 'pending'),
        )
        .first(),
      getActiveParticipants(ctx, args.projectId),
    ])
    const participants = await Promise.all(projectCompanies.map(async (projectCompany) => ({
      projectCompany,
      company: await ctx.db.get(projectCompany.companyId),
    })))
    if (!request) {
      return {
        request: null,
        proposedOwningCompany: null,
        participants,
        approvals: [],
      }
    }
    const [proposedOwningCompany, approvals] = await Promise.all([
      ctx.db.get(request.proposedOwningCompanyId),
      ctx.db
        .query('projectOwnershipApprovals')
        .withIndex('by_request', (q) => q.eq('requestId', request._id))
        .collect(),
    ])
    const decisions = await Promise.all(approvals.map(async (approval) => {
      const projectCompany = await ctx.db.get(approval.projectCompanyId)
      return {
        approval,
        projectCompany,
        company: projectCompany ? await ctx.db.get(projectCompany.companyId) : null,
      }
    }))
    return {
      request,
      proposedOwningCompany,
      participants,
      approvals: decisions,
    }
  },
})

export const request = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    proposedOwningCompanyId: v.id('companies'),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireOwnershipAuthority(ctx, actor, args)
    await assertProjectSnapshotWritable(ctx, args.projectId)
    const existing = await ctx.db
      .query('projectOwnershipRequests')
      .withIndex('by_project_idempotency', (q) =>
        q.eq('projectId', access.project._id).eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()
    if (existing) return existing._id
    if (
      access.project.owningCompanyId &&
      access.project.owningCompanyId !== access.company._id
    ) {
      throw new Error('owning_company_required')
    }
    if (access.project.owningCompanyId === args.proposedOwningCompanyId) {
      throw new Error('project_owner_unchanged')
    }
    const pending = await ctx.db
      .query('projectOwnershipRequests')
      .withIndex('by_project_status', (q) =>
        q.eq('projectId', access.project._id).eq('status', 'pending'),
      )
      .first()
    if (pending) throw new Error('project_ownership_request_pending')
    const participants = await getActiveParticipants(ctx, access.project._id)
    if (!participants.some((participant) =>
      participant.companyId === args.proposedOwningCompanyId,
    )) {
      throw new Error('proposed_owner_not_participating')
    }
    const now = Date.now()
    const requestId = await ctx.db.insert('projectOwnershipRequests', {
      projectId: access.project._id,
      participantRevision: access.project.participantRevision ?? 0,
      sourceOwningCompanyId: access.project.owningCompanyId,
      proposedOwningCompanyId: args.proposedOwningCompanyId,
      requestedByCompanyId: access.company._id,
      requestedBy: actor.userId,
      status: 'pending',
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    const request = await ctx.db.get(requestId)
    if (!request) throw new Error('project_ownership_request_failed')
    await ctx.db.insert('projectOwnershipApprovals', {
      requestId,
      projectCompanyId: access.projectCompany._id,
      decidedBy: actor.userId,
      decision: 'approved',
      participantRevision: request.participantRevision,
      createdAt: now,
    })
    await appendAuditEvent(ctx, {
      companyId: access.company._id,
      projectId: access.project._id,
      actorId: actor.userId,
      actingCompanyId: access.company._id,
      entityType: 'projectOwnershipRequest',
      entityId: requestId,
      action: 'project_ownership.requested',
      after: { proposedOwningCompanyId: args.proposedOwningCompanyId },
    })
    if (participants.length === 1) {
      await assignOwnership(ctx, {
        project: access.project,
        request,
        actorId: actor.userId,
        actingCompanyId: access.company._id,
      })
    }
    return requestId
  },
})

export const decide = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    requestId: v.id('projectOwnershipRequests'),
    decision: v.union(v.literal('approve'), v.literal('reject')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireOwnershipAuthority(ctx, actor, args)
    await assertProjectSnapshotWritable(ctx, args.projectId)
    const request = await ctx.db.get(args.requestId)
    if (
      !request ||
      request.projectId !== access.project._id ||
      request.status !== 'pending'
    ) {
      return request?._id ?? null
    }
    const ownershipChanged =
      (access.project.owningCompanyId ?? null) !==
      (request.sourceOwningCompanyId ?? null)
    if (
      ownershipChanged ||
      (access.project.participantRevision ?? 0) !== request.participantRevision
    ) {
      await ctx.db.patch(request._id, { status: 'stale', updatedAt: Date.now() })
      return request._id
    }
    const existing = await ctx.db
      .query('projectOwnershipApprovals')
      .withIndex('by_request_participant', (q) =>
        q.eq('requestId', request._id).eq('projectCompanyId', access.projectCompany._id),
      )
      .unique()
    if (existing) return request._id
    const now = Date.now()
    const decision = args.decision === 'approve' ? 'approved' : 'rejected'
    await ctx.db.insert('projectOwnershipApprovals', {
      requestId: request._id,
      projectCompanyId: access.projectCompany._id,
      decidedBy: actor.userId,
      decision,
      participantRevision: request.participantRevision,
      createdAt: now,
    })
    if (decision === 'rejected') {
      await ctx.db.patch(request._id, { status: 'cancelled', decidedAt: now, updatedAt: now })
      return request._id
    }
    const [participants, approvals] = await Promise.all([
      getActiveParticipants(ctx, access.project._id),
      ctx.db
        .query('projectOwnershipApprovals')
        .withIndex('by_request', (q) => q.eq('requestId', request._id))
        .collect(),
    ])
    const approvalMap = new Map(approvals.map((approval) => [
      approval.projectCompanyId,
      approval.decision,
    ]))
    approvalMap.set(access.projectCompany._id, 'approved')
    if (!hasUnanimousApproval(
      participants.map((participant) => participant._id),
      approvalMap,
    )) {
      return request._id
    }
    if (!participants.some((participant) =>
      participant.companyId === request.proposedOwningCompanyId,
    )) {
      await ctx.db.patch(request._id, { status: 'stale', updatedAt: now })
      return request._id
    }
    await assignOwnership(ctx, {
      project: access.project,
      request,
      actorId: actor.userId,
      actingCompanyId: access.company._id,
    })
    return request._id
  },
})
