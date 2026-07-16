import { hasUnanimousApproval } from '@track/shared/company'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireAuthenticatedActor } from './lib/actorContext'
import {
  requireActiveRelationshipParticipant,
  requireCompanyAdmin,
  requireCompanyModelEnabled,
} from './lib/companyPolicy'
import {
  createInvitationToken,
  hashInvitationToken,
  invitationLifetimeMs,
} from './lib/companyInvitations'
import {
  getActiveRelationshipCompanies,
  refreshRelationshipAfterParticipantChange,
} from './lib/relationshipLifecycle'

async function inviteTargetCompany(
  ctx: MutationCtx,
  input: {
    relationshipId: Id<'relationships'>
    targetCompanyId: Id<'companies'>
    invitingCompanyId: Id<'companies'>
    actorId: Id<'users'>
  },
) {
  const existing = await ctx.db
    .query('relationshipInvitations')
    .withIndex('by_target_status', (q) =>
      q.eq('targetCompanyId', input.targetCompanyId).eq('status', 'pending'),
    )
    .collect()
  const duplicate = existing.find((invite) => invite.relationshipId === input.relationshipId)
  if (duplicate && duplicate.expiresAt > Date.now()) return { invitationId: duplicate._id, token: null }
  const token = createInvitationToken()
  const now = Date.now()
  const invitationId = await ctx.db.insert('relationshipInvitations', {
    relationshipId: input.relationshipId,
    targetCompanyId: input.targetCompanyId,
    invitingCompanyId: input.invitingCompanyId,
    invitedBy: input.actorId,
    tokenHash: await hashInvitationToken(token),
    status: 'pending',
    expiresAt: now + invitationLifetimeMs,
    createdAt: now,
    updatedAt: now,
  })
  return { invitationId, token }
}

export const listMine = query({
  args: { actingCompanyId: v.id('companies') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const terms = await ctx.db
      .query('relationshipCompanies')
      .withIndex('by_company_status', (q) => q.eq('companyId', args.actingCompanyId).eq('status', 'active'))
      .collect()
    return await Promise.all(terms.map(async (term) => {
      const relationship = await ctx.db.get(term.relationshipId)
      if (!relationship) return null
      const participants = await ctx.db
        .query('relationshipCompanies')
        .withIndex('by_relationship_status', (q) =>
          q.eq('relationshipId', relationship._id).eq('status', 'active'),
        )
        .collect()
      const pendingRemovalRequests = await ctx.db
        .query('relationshipRemovalRequests')
        .withIndex('by_relationship_status', (q) =>
          q.eq('relationshipId', relationship._id).eq('status', 'pending'),
        )
        .collect()
      return {
        relationship,
        pendingRemovalRequests,
        participants: await Promise.all(participants.map(async (participant) => {
          const company = await ctx.db.get(participant.companyId)
          return company ? { _id: company._id, displayName: company.displayName, normalizedHandle: company.normalizedHandle } : null
        })).then((companies) => companies.filter((company) => company !== null)),
      }
    })).then((relationships) => relationships.filter((relationship) => relationship !== null))
  },
})

export const listInvitations = query({
  args: { actingCompanyId: v.id('companies') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const invites = await ctx.db
      .query('relationshipInvitations')
      .withIndex('by_target_status', (q) => q.eq('targetCompanyId', args.actingCompanyId).eq('status', 'pending'))
      .collect()
    return await Promise.all(invites.map(async (invitation) => {
      const [relationship, invitingCompany, inviter] = await Promise.all([
        ctx.db.get(invitation.relationshipId),
        ctx.db.get(invitation.invitingCompanyId),
        ctx.db.get(invitation.invitedBy),
      ])
      const participants = relationship
        ? await ctx.db
            .query('relationshipCompanies')
            .withIndex('by_relationship_status', (q) =>
              q.eq('relationshipId', relationship._id).eq('status', 'active'),
            )
            .collect()
        : []
      return {
        invitation,
        relationship: relationship ? { _id: relationship._id, name: relationship.name } : null,
        invitingCompany: invitingCompany ? { _id: invitingCompany._id, displayName: invitingCompany.displayName, normalizedHandle: invitingCompany.normalizedHandle } : null,
        inviter: inviter ? { displayName: inviter.displayName } : null,
        participants: await Promise.all(participants.map(async (participant) => {
          const company = await ctx.db.get(participant.companyId)
          return company ? { _id: company._id, displayName: company.displayName, normalizedHandle: company.normalizedHandle } : null
        })).then((companies) => companies.filter((company) => company !== null)),
      }
    }))
  },
})

export const create = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    name: v.string(),
    targetCompanyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const target = await ctx.db.get(args.targetCompanyId)
    if (!target || target.status !== 'active' || target._id === args.actingCompanyId) {
      throw new Error('target_company_unavailable')
    }
    const name = args.name.trim()
    if (!name) throw new Error('relationship_name_required')
    const now = Date.now()
    const relationshipId = await ctx.db.insert('relationships', {
      name,
      status: 'forming',
      createdBy: actor.userId,
      createdByCompanyId: args.actingCompanyId,
      participantRevision: 1,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('relationshipCompanies', {
      relationshipId,
      companyId: args.actingCompanyId,
      term: 1,
      status: 'active',
      acceptedBy: actor.userId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const invite = await inviteTargetCompany(ctx, {
      relationshipId,
      targetCompanyId: target._id,
      invitingCompanyId: args.actingCompanyId,
      actorId: actor.userId,
    })
    await appendAuditEvent(ctx, {
      companyId: args.actingCompanyId,
      relationshipId,
      actorId: actor.userId,
      actingCompanyId: args.actingCompanyId,
      entityType: 'relationship',
      entityId: relationshipId,
      action: 'relationship.created',
      after: { name, targetCompanyId: target._id },
    })
    return { relationshipId, ...invite }
  },
})

export const inviteCompany = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    relationshipId: v.id('relationships'),
    targetCompanyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    await requireActiveRelationshipParticipant(ctx, args.relationshipId, args.actingCompanyId)
    const [relationship, target] = await Promise.all([
      ctx.db.get(args.relationshipId),
      ctx.db.get(args.targetCompanyId),
    ])
    if (!relationship || relationship.status === 'closed' || !target || target.status !== 'active') {
      throw new Error('relationship_invitation_unavailable')
    }
    const active = await ctx.db
      .query('relationshipCompanies')
      .withIndex('by_relationship_status', (q) =>
        q.eq('relationshipId', relationship._id).eq('status', 'active'),
      )
      .collect()
    if (active.some((term) => term.companyId === target._id)) throw new Error('company_already_participates')
    if (relationship.status === 'inactive') {
      await ctx.db.patch(relationship._id, { status: 'forming', revision: relationship.revision + 1, updatedAt: Date.now() })
    }
    return await inviteTargetCompany(ctx, {
      relationshipId: relationship._id,
      targetCompanyId: target._id,
      invitingCompanyId: args.actingCompanyId,
      actorId: actor.userId,
    })
  },
})

export const decideInvitation = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    invitationId: v.id('relationshipInvitations'),
    decision: v.union(v.literal('accept'), v.literal('decline')),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation || invitation.targetCompanyId !== args.actingCompanyId || invitation.status !== 'pending') {
      return invitation?._id ?? null
    }
    const now = Date.now()
    if (invitation.expiresAt <= now) {
      await ctx.db.patch(invitation._id, { status: 'expired', updatedAt: now })
      throw new Error('invitation_expired')
    }
    if (args.decision === 'decline') {
      await ctx.db.patch(invitation._id, { status: 'declined', decidedBy: actor.userId, decidedAt: now, updatedAt: now })
      return invitation._id
    }
    const [relationship, target, invitingCompany] = await Promise.all([
      ctx.db.get(invitation.relationshipId),
      ctx.db.get(args.actingCompanyId),
      ctx.db.get(invitation.invitingCompanyId),
    ])
    if (
      !relationship ||
      relationship.status === 'closed' ||
      !target ||
      target.status !== 'active' ||
      !invitingCompany ||
      invitingCompany.status !== 'active'
    ) {
      throw new Error('relationship_unavailable')
    }
    const terms = await ctx.db
      .query('relationshipCompanies')
      .withIndex('by_relationship_company_term', (q) =>
        q.eq('relationshipId', relationship._id).eq('companyId', target._id),
      )
      .collect()
    const active = terms.find((term) => term.status === 'active')
    if (!active) {
      await ctx.db.insert('relationshipCompanies', {
        relationshipId: relationship._id,
        companyId: target._id,
        term: Math.max(0, ...terms.map((term) => term.term)) + 1,
        status: 'active',
        acceptedBy: actor.userId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await refreshRelationshipAfterParticipantChange(ctx, relationship._id, now)
    }
    await ctx.db.patch(invitation._id, { status: 'accepted', decidedBy: actor.userId, decidedAt: now, updatedAt: now })
    return invitation._id
  },
})

export const leave = mutation({
  args: { actingCompanyId: v.id('companies'), relationshipId: v.id('relationships') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const term = await requireActiveRelationshipParticipant(ctx, args.relationshipId, args.actingCompanyId)
    const now = Date.now()
    await ctx.db.patch(term._id, { status: 'left', endedBy: actor.userId, endedAt: now, updatedAt: now })
    await refreshRelationshipAfterParticipantChange(ctx, args.relationshipId, now)
    return term._id
  },
})

export const proposeRemoval = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    relationshipId: v.id('relationships'),
    targetCompanyId: v.id('companies'),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    await requireActiveRelationshipParticipant(ctx, args.relationshipId, args.actingCompanyId)
    await requireActiveRelationshipParticipant(ctx, args.relationshipId, args.targetCompanyId)
    if (args.actingCompanyId === args.targetCompanyId) throw new Error('target_cannot_propose_removal')
    const existing = await ctx.db
      .query('relationshipRemovalRequests')
      .withIndex('by_relationship_idempotency', (q) =>
        q.eq('relationshipId', args.relationshipId).eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()
    if (existing) return existing._id
    const relationship = await ctx.db.get(args.relationshipId)
    if (!relationship) throw new Error('relationship_unavailable')
    const now = Date.now()
    return await ctx.db.insert('relationshipRemovalRequests', {
      relationshipId: relationship._id,
      targetCompanyId: args.targetCompanyId,
      participantRevision: relationship.participantRevision,
      proposedByCompanyId: args.actingCompanyId,
      proposedBy: actor.userId,
      status: 'pending',
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const approveRemoval = mutation({
  args: { actingCompanyId: v.id('companies'), requestId: v.id('relationshipRemovalRequests') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const request = await ctx.db.get(args.requestId)
    if (!request || request.status !== 'pending') return request?._id ?? null
    const relationship = await ctx.db.get(request.relationshipId)
    if (!relationship || relationship.participantRevision !== request.participantRevision) {
      await ctx.db.patch(request._id, { status: 'stale', updatedAt: Date.now() })
      return request._id
    }
    await requireActiveRelationshipParticipant(ctx, relationship._id, args.actingCompanyId)
    if (args.actingCompanyId === request.targetCompanyId) throw new Error('target_cannot_approve_removal')
    const existing = await ctx.db
      .query('relationshipRemovalApprovals')
      .withIndex('by_request_company', (q) => q.eq('requestId', request._id).eq('companyId', args.actingCompanyId))
      .unique()
    if (!existing) {
      await ctx.db.insert('relationshipRemovalApprovals', {
        requestId: request._id,
        companyId: args.actingCompanyId,
        decidedBy: actor.userId,
        decision: 'approved',
        participantRevision: request.participantRevision,
        createdAt: Date.now(),
      })
    }
    const [participants, approvals] = await Promise.all([
      getActiveRelationshipCompanies(ctx, relationship._id),
      ctx.db.query('relationshipRemovalApprovals').withIndex('by_request', (q) => q.eq('requestId', request._id)).collect(),
    ])
    const eligible = participants.filter((participant) => participant.companyId !== request.targetCompanyId)
    const approvalMap = new Map(approvals.map((approval) => [approval.companyId, approval.decision]))
    approvalMap.set(args.actingCompanyId, 'approved')
    if (!hasUnanimousApproval(eligible.map((participant) => participant.companyId), approvalMap)) return request._id
    const target = participants.find((participant) => participant.companyId === request.targetCompanyId)
    if (!target) throw new Error('approval_stale')
    const now = Date.now()
    await ctx.db.patch(target._id, { status: 'removed', endedBy: actor.userId, endedAt: now, updatedAt: now })
    await ctx.db.patch(request._id, { status: 'approved', decidedAt: now, updatedAt: now })
    await refreshRelationshipAfterParticipantChange(ctx, relationship._id, now)
    return request._id
  },
})
