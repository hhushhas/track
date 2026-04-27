import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember, requireReviewer } from './lib/permissions'

const recordType = v.union(
  v.literal('task'),
  v.literal('scope_change'),
  v.literal('decision'),
  v.literal('action_item'),
  v.literal('blocker'),
  v.literal('question'),
)

const recordClassification = v.union(
  v.literal('official_record'),
  v.literal('billable_scope'),
  v.literal('non_billable_scope'),
  v.literal('informational'),
  v.literal('ignored'),
)

const recordStatus = v.union(
  v.literal('proposed'),
  v.literal('accepted'),
  v.literal('declined'),
  v.literal('open'),
  v.literal('in_progress'),
  v.literal('blocked'),
  v.literal('done'),
)

export const listDrafts = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.db
      .query('draftRecords')
      .withIndex('by_group_status', (q) => q.eq('groupId', args.groupId))
      .collect()
  },
})

export const listProjectRecords = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const groupMemberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    const visibleGroupIds = new Set(
      groupMemberships
        .filter((membership) => membership.projectId === args.projectId)
        .map((membership) => membership.groupId),
    )
    const records = await ctx.db
      .query('records')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    return records.filter((record) => visibleGroupIds.has(record.groupId))
  },
})

export const createDraft = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    aiReviewId: v.optional(v.id('aiReviews')),
    userId: v.id('users'),
    sourceMessageIds: v.array(v.id('messages')),
    type: recordType,
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.userId)
    await requireGroupMember(ctx, args.groupId, args.userId)
    const now = Date.now()
    const draftId = await ctx.db.insert('draftRecords', {
      projectId: args.projectId,
      groupId: args.groupId,
      aiReviewId: args.aiReviewId,
      sourceMessageIds: args.sourceMessageIds,
      type: args.type,
      title: args.title,
      description: args.description,
      proposedStatus: 'open',
      evidence: [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.userId,
      entityType: 'draftRecord',
      entityId: draftId,
      action: 'draft_record.created',
      after: { title: args.title, type: args.type },
    })
    return draftId
  },
})

export const classifyDraft = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    draftRecordId: v.id('draftRecords'),
    reviewerId: v.id('users'),
    classification: recordClassification,
    status: recordStatus,
    ownerId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.reviewerId)
    await requireGroupMember(ctx, args.groupId, args.reviewerId)
    const draft = await ctx.db.get(args.draftRecordId)
    if (!draft) throw new Error('draft_not_found')
    const now = Date.now()

    await ctx.db.patch(args.draftRecordId, {
      status: args.classification === 'ignored' ? 'declined' : 'accepted',
      updatedAt: now,
    })

    if (args.classification === 'ignored') {
      await appendAuditEvent(ctx, {
        projectId: args.projectId,
        groupId: args.groupId,
        actorId: args.reviewerId,
        entityType: 'draftRecord',
        entityId: args.draftRecordId,
        action: 'draft_record.ignored',
      })
      return null
    }

    const recordId = await ctx.db.insert('records', {
      projectId: args.projectId,
      groupId: args.groupId,
      draftRecordId: args.draftRecordId,
      sourceMessageIds: draft.sourceMessageIds,
      type: draft.type,
      classification: args.classification,
      status: args.status,
      title: draft.title,
      description: draft.description,
      ownerId: args.ownerId,
      reviewedBy: args.reviewerId,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.reviewerId,
      entityType: 'record',
      entityId: recordId,
      action: 'record.accepted',
      after: {
        draftRecordId: args.draftRecordId,
        classification: args.classification,
        status: args.status,
      },
    })

    return recordId
  },
})
