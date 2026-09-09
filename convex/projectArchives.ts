import { hasUnanimousApproval } from '@track/shared/company'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import {
  resolveCompanyProjectAccess,
} from './lib/companyPolicy'
import { revokePendingProjectInvitations } from './lib/companyProjectLifecycle'

async function requireManagerTerm(
  ctx: Parameters<typeof resolveCompanyProjectAccess>[0],
  actor: Parameters<typeof resolveCompanyProjectAccess>[1],
  input: Parameters<typeof resolveCompanyProjectAccess>[2],
) {
  const access = await resolveCompanyProjectAccess(ctx, actor, input)
  if (access.projectMember.role !== 'manager') throw new Error('project_manager_required')
  return access
}

async function getActiveProjectCompany(
  ctx: Parameters<typeof resolveCompanyProjectAccess>[0],
  projectId: Doc<'projects'>['_id'],
  companyId: Doc<'companies'>['_id'],
) {
  const participations = await ctx.db
    .query('projectCompanies')
    .withIndex('by_project_status', (q) => q.eq('projectId', projectId).eq('status', 'active'))
    .collect()
  const participation = participations.find((item) => item.companyId === companyId)
  if (!participation) throw new Error('project_participation_unavailable')
  return participation
}

export const listPending = query({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    await requireManagerTerm(ctx, actor, args)
    return await ctx.db
      .query('projectArchiveRequests')
      .withIndex('by_project_status', (q) => q.eq('projectId', args.projectId).eq('status', 'pending'))
      .collect()
  },
})

export const request = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    operation: v.union(v.literal('archive'), v.literal('restore')),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireManagerTerm(ctx, actor, args)
    const expected = args.operation === 'archive' ? 'active' : 'archived'
    if (access.project.status !== expected) throw new Error('project_lifecycle_conflict')
    const existing = await ctx.db
      .query('projectArchiveRequests')
      .withIndex('by_project_idempotency', (q) =>
        q.eq('projectId', access.project._id).eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()
    if (existing) return existing._id
    const now = Date.now()
    const requestId = await ctx.db.insert('projectArchiveRequests', {
      projectId: access.project._id,
      participantRevision: access.project.participantRevision ?? 0,
      requestedByCompanyId: access.company._id,
      requestedBy: actor.userId,
      operation: args.operation,
      status: 'pending',
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    if (args.operation === 'archive') {
      await ctx.db.patch(access.project._id, { status: 'archive_pending', updatedAt: now })
    }
    await appendAuditEvent(ctx, {
      companyId: access.company._id, projectId: access.project._id, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.company._id,
      entityType: 'projectArchiveRequest', entityId: requestId,
      action: `project.${args.operation}_requested`,
      before: { status: expected },
      after: { status: args.operation === 'archive' ? 'archive_pending' : expected },
    })
    return requestId
  },
})

export const approve = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    requestId: v.id('projectArchiveRequests'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    await requireManagerTerm(ctx, actor, args)
    const [project, request] = await Promise.all([
      ctx.db.get(args.projectId),
      ctx.db.get(args.requestId),
    ])
    if (!project || !request || request.projectId !== project._id || request.status !== 'pending') {
      return request?._id ?? null
    }
    if ((project.participantRevision ?? 0) !== request.participantRevision) {
      await ctx.db.patch(request._id, { status: 'stale', updatedAt: Date.now() })
      return request._id
    }
    const projectCompany = await getActiveProjectCompany(ctx, project._id, args.actingCompanyId)
    const existing = await ctx.db
      .query('projectArchiveApprovals')
      .withIndex('by_request_participant', (q) =>
        q.eq('requestId', request._id).eq('projectCompanyId', projectCompany._id),
      )
      .unique()
    if (!existing) await ctx.db.insert('projectArchiveApprovals', {
      requestId: request._id,
      projectCompanyId: projectCompany._id,
      decidedBy: actor.userId,
      decision: 'approved',
      participantRevision: request.participantRevision,
      createdAt: Date.now(),
    })
    const [participants, approvals] = await Promise.all([
      ctx.db.query('projectCompanies').withIndex('by_project_status', (q) => q.eq('projectId', project._id).eq('status', 'active')).collect(),
      ctx.db.query('projectArchiveApprovals').withIndex('by_request', (q) => q.eq('requestId', request._id)).collect(),
    ])
    const approvalMap = new Map(approvals.map((approval) => [approval.projectCompanyId, approval.decision]))
    approvalMap.set(projectCompany._id, 'approved')
    if (!hasUnanimousApproval(participants.map((participant) => participant._id), approvalMap)) return request._id
    const now = Date.now()
    await ctx.db.patch(project._id, {
      status: request.operation === 'archive' ? 'archived' : 'active',
      revision: (project.revision ?? 0) + 1,
      updatedAt: now,
    })
    if (request.operation === 'archive') {
      await revokePendingProjectInvitations(ctx, project._id, now)
    }
    await ctx.db.patch(request._id, { status: 'approved', decidedAt: now, updatedAt: now })
    await appendAuditEvent(ctx, {
      companyId: args.actingCompanyId, projectId: project._id, actorId: actor.userId,
      actorProjectMemberId: args.projectMemberId, actingCompanyId: args.actingCompanyId,
      entityType: 'projectArchiveRequest', entityId: request._id,
      action: request.operation === 'archive' ? 'project.archived' : 'project.restored',
      before: { status: request.operation === 'archive' ? 'archive_pending' : 'archived' },
      after: { status: request.operation === 'archive' ? 'archived' : 'active' },
    })
    return request._id
  },
})

export const cancel = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    requestId: v.id('projectArchiveRequests'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireManagerTerm(ctx, actor, args)
    const request = await ctx.db.get(args.requestId)
    if (!request || request.projectId !== access.project._id || request.status !== 'pending') return request?._id ?? null
    const now = Date.now()
    await ctx.db.patch(request._id, { status: 'cancelled', decidedAt: now, updatedAt: now })
    if (access.project.status === 'archive_pending') {
      await ctx.db.patch(access.project._id, { status: 'active', updatedAt: now })
    }
    await appendAuditEvent(ctx, {
      companyId: access.company._id, projectId: access.project._id, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.company._id,
      entityType: 'projectArchiveRequest', entityId: request._id,
      action: 'project_archive.cancelled', before: { status: 'pending' }, after: { status: 'cancelled' },
    })
    return request._id
  },
})
