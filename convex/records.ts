import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember, requireProjectMember, requireReviewer } from './lib/permissions'

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

function buildRecordSearchText(record: {
  classification?: string
  description: string
  status: string
  title: string
  type: string
}) {
  return [
    record.title,
    record.description,
    record.type.replaceAll('_', ' '),
    record.classification?.replaceAll('_', ' '),
    record.status.replaceAll('_', ' '),
  ]
    .filter(Boolean)
    .join(' ')
}

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
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.reviewerId)
    await requireGroupMember(ctx, args.groupId, args.reviewerId)
    const draft = await ctx.db.get(args.draftRecordId)
    if (!draft) throw new Error('draft_not_found')
    const now = Date.now()
    const title = args.title?.trim() || draft.title
    const description = args.description?.trim() || draft.description

    await ctx.db.patch(args.draftRecordId, {
      title,
      description,
      proposedStatus: args.status,
      proposedOwnerId: args.ownerId ?? draft.proposedOwnerId,
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
      title,
      description,
      searchText: buildRecordSearchText({
        classification: args.classification,
        description,
        status: args.status,
        title,
        type: draft.type,
      }),
      ownerId: args.ownerId ?? draft.proposedOwnerId,
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

export const updateStatus = mutation({
  args: {
    projectId: v.id('projects'),
    recordId: v.id('records'),
    actorId: v.id('users'),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('blocked'),
      v.literal('done'),
    ),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.actorId)
    const record = await ctx.db.get(args.recordId)
    if (!record || record.projectId !== args.projectId) throw new Error('record_not_found')
    await requireGroupMember(ctx, record.groupId, args.actorId)

    const before = { status: record.status }
    await ctx.db.patch(args.recordId, {
      status: args.status,
      searchText: buildRecordSearchText({
        classification: record.classification,
        description: record.description,
        status: args.status,
        title: record.title,
        type: record.type,
      }),
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: record.groupId,
      actorId: args.actorId,
      entityType: 'record',
      entityId: args.recordId,
      action: 'record.status_updated',
      before,
      after: { status: args.status },
    })
  },
})
