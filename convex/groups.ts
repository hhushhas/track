import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import {
  canRoleJoinDefaultGroup,
  requireGroupMember,
  requireProjectManager,
  requireProjectMember,
} from './lib/permissions'

const role = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('staff'),
  v.literal('client'),
)

export const listVisible = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    const visibleMemberships = memberships.filter(
      (membership) => membership.projectId === args.projectId,
    )

    const groups = await Promise.all(
      visibleMemberships.map(async (membership) => await ctx.db.get(membership.groupId)),
    )

    return groups.filter((group) => group !== null)
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.userId)
    const now = Date.now()
    const groupId = await ctx.db.insert('groups', {
      projectId: args.projectId,
      kind: 'custom',
      name: args.name,
      aiReviewSettings: {
        enabled: true,
        frequencyMinutes: 30,
      },
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('groupMembers', {
      projectId: args.projectId,
      groupId,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    })
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId,
      actorId: args.userId,
      entityType: 'group',
      entityId: groupId,
      action: 'group.created',
      after: { name: args.name },
    })
    return groupId
  },
})

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.userId)
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) throw new Error('group_not_found')
    const name = args.name.trim()
    if (!name) throw new Error('group_name_required')

    await ctx.db.patch(args.groupId, {
      name,
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.userId,
      entityType: 'group',
      entityId: args.groupId,
      action: 'group.updated',
      before: { name: group.name },
      after: { name },
    })
  },
})

export const remove = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.userId)
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) throw new Error('group_not_found')

    const [
      groupMembers,
      messages,
      attachments,
      typingIndicators,
      aiReviews,
      draftRecords,
      records,
      assistantStreams,
      groupNotificationSettings,
      invitations,
    ] = await Promise.all([
      ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('messages').withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('attachments').withIndex('by_group', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('typingIndicators').withIndex('by_group_updated_at', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('aiReviews').withIndex('by_group_started_at', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('draftRecords').withIndex('by_group_status', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('records').withIndex('by_group', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('assistantStreams').withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('groupNotificationSettings').collect(),
      Promise.all(
        (['pending', 'accepted', 'revoked', 'expired'] as const).map((status) =>
          ctx.db.query('invitations').withIndex('by_project_status', (q) => q.eq('projectId', args.projectId).eq('status', status)).collect(),
        ),
      ).then((rows) => rows.flat()),
    ])

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.userId,
      entityType: 'group',
      entityId: args.groupId,
      action: 'group.deleted',
      before: { name: group.name, kind: group.kind },
    })

    await Promise.all(attachments.map((attachment) => ctx.storage.delete(attachment.storageId).catch(() => undefined)))

    for (const row of groupNotificationSettings) {
      if (row.groupId === args.groupId) await ctx.db.delete(row._id)
    }
    for (const row of invitations) {
      if (row.groupId === args.groupId) await ctx.db.delete(row._id)
    }
    for (const row of assistantStreams) await ctx.db.delete(row._id)
    for (const row of records) await ctx.db.delete(row._id)
    for (const row of draftRecords) await ctx.db.delete(row._id)
    for (const row of aiReviews) await ctx.db.delete(row._id)
    for (const row of typingIndicators) await ctx.db.delete(row._id)
    for (const row of attachments) await ctx.db.delete(row._id)
    for (const row of messages) await ctx.db.delete(row._id)
    for (const row of groupMembers) await ctx.db.delete(row._id)
    await ctx.db.delete(args.groupId)
  },
})

export const updateAiReviewSettings = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    enabled: v.boolean(),
    frequencyMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.userId)
    await requireGroupMember(ctx, args.groupId, args.userId)
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) throw new Error('group_not_found')
    const frequencyMinutes = Math.max(5, Math.min(1440, Math.round(args.frequencyMinutes)))

    await ctx.db.patch(args.groupId, {
      aiReviewSettings: {
        enabled: args.enabled,
        frequencyMinutes,
      },
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.userId,
      entityType: 'group',
      entityId: args.groupId,
      action: 'group.ai_review_settings_updated',
      after: {
        enabled: args.enabled,
        frequencyMinutes,
      },
    })
  },
})

export const addProjectMember = mutation({
  args: {
    projectId: v.id('projects'),
    actorId: v.id('users'),
    userId: v.id('users'),
    role,
    canReviewAiRecords: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.actorId)
    const now = Date.now()
    const existing = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', (q) =>
        q.eq('projectId', args.projectId).eq('userId', args.userId),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        canReviewAiRecords: args.canReviewAiRecords,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('projectMembers', {
        projectId: args.projectId,
        userId: args.userId,
        role: args.role,
        canReviewAiRecords: args.canReviewAiRecords,
        createdAt: now,
        updatedAt: now,
      })
    }

    const groups = await ctx.db
      .query('groups')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()

    for (const group of groups) {
      if (!canRoleJoinDefaultGroup(args.role, group.kind)) continue
      const existingGroupMember = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (q) =>
          q.eq('groupId', group._id).eq('userId', args.userId),
        )
        .unique()
      if (!existingGroupMember) {
        await ctx.db.insert('groupMembers', {
          projectId: args.projectId,
          groupId: group._id,
          userId: args.userId,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.actorId,
      entityType: 'projectMember',
      entityId: args.userId,
      action: 'project_member.upserted',
      after: {
        userId: args.userId,
        role: args.role,
        canReviewAiRecords: args.canReviewAiRecords,
      },
    })
  },
})

export const addGroupMember = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    actorId: v.id('users'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectManager(ctx, args.projectId, args.actorId)
    await requireProjectMember(ctx, args.projectId, args.userId)
    const now = Date.now()
    const existing = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', args.userId),
      )
      .unique()
    if (!existing) {
      await ctx.db.insert('groupMembers', {
        projectId: args.projectId,
        groupId: args.groupId,
        userId: args.userId,
        createdAt: now,
        updatedAt: now,
      })
    }
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.actorId,
      entityType: 'groupMember',
      entityId: args.userId,
      action: 'group_member.added',
      after: { userId: args.userId },
    })
  },
})

export const listMembers = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect()
    return await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return { membership, user }
      }),
    )
  },
})
