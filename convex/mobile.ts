import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { requireGroupMember, requireProjectMember } from './lib/permissions'

const platform = v.union(v.literal('web'), v.literal('ios'), v.literal('android'))

async function getGroupUnreadCount(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
) {
  const readState = await ctx.db
    .query('groupReadStates')
    .withIndex('by_user_group', (q) => q.eq('userId', userId).eq('groupId', groupId))
    .unique()
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_group_created_at', (q) => q.eq('groupId', groupId))
    .collect()

  return messages.filter((message) => {
    if (message.authorId === userId) return false
    if (!readState) return true
    return message.createdAt > readState.lastReadAt
  }).length
}

export const listProjects = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const project = await ctx.db.get(membership.projectId)
        if (!project) return null
        const groupMemberships = await ctx.db
          .query('groupMembers')
          .withIndex('by_user', (q) => q.eq('userId', args.userId))
          .collect()
        const projectGroupMemberships = groupMemberships.filter(
          (item) => item.projectId === project._id,
        )
        const unreadCount = (
          await Promise.all(
            projectGroupMemberships.map((item) =>
              getGroupUnreadCount(ctx, item.groupId, args.userId),
            ),
          )
        ).reduce((total, count) => total + count, 0)

        return {
          project,
          membership,
          groupCount: projectGroupMemberships.length,
          unreadCount,
        }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

export const listGroups = query({
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

    const rows = await Promise.all(
      visibleMemberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId)
        if (!group) return null
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_group_created_at', (q) => q.eq('groupId', group._id))
          .order('desc')
          .first()
        const unreadCount = await getGroupUnreadCount(ctx, group._id, args.userId)
        return { group, membership, lastMessage, unreadCount }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

export const getLastActiveContext = query({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const byDevice = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : null
    if (byDevice) return byDevice

    return await ctx.db
      .query('lastActiveContexts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .first()
  },
})

export const setLastActiveContext = mutation({
  args: {
    userId: v.id('users'),
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    deviceId: v.optional(v.string()),
    platform: v.optional(platform),
  },
  handler: async (ctx, args) => {
    if (args.projectId) await requireProjectMember(ctx, args.projectId, args.userId)
    if (args.groupId) await requireGroupMember(ctx, args.groupId, args.userId)

    const now = Date.now()
    const existing = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user', (q) => q.eq('userId', args.userId))
          .first()

    const payload = {
      projectId: args.projectId,
      groupId: args.groupId,
      deviceId: args.deviceId,
      platform: args.platform,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }
    return await ctx.db.insert('lastActiveContexts', {
      userId: args.userId,
      ...payload,
    })
  },
})

export const markGroupRead = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    lastReadMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const membership = await requireGroupMember(ctx, args.groupId, args.userId)
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('group_not_found')
    if (args.lastReadMessageId) {
      const message = await ctx.db.get(args.lastReadMessageId)
      if (!message || message.groupId !== args.groupId) throw new Error('message_not_found')
    }

    const now = Date.now()
    const existing = await ctx.db
      .query('groupReadStates')
      .withIndex('by_user_group', (q) => q.eq('userId', args.userId).eq('groupId', args.groupId))
      .unique()
    const payload = {
      projectId: membership.projectId,
      groupId: args.groupId,
      userId: args.userId,
      lastReadMessageId: args.lastReadMessageId,
      lastReadAt: now,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert('groupReadStates', {
      ...payload,
      createdAt: now,
    })
  },
})
