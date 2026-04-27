import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember } from './lib/permissions'

const notificationMode = v.union(
  v.literal('all'),
  v.literal('mentions'),
  v.literal('none'),
)

const groupNotificationMode = v.union(
  v.literal('inherit'),
  v.literal('all'),
  v.literal('mentions'),
  v.literal('none'),
)

export const getSettings = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const global = await ctx.db
      .query('notificationSettings')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    const groups = await ctx.db
      .query('groupNotificationSettings')
      .withIndex('by_user_group', (q) => q.eq('userId', args.userId))
      .collect()
    return { global, groups }
  },
})

export const setGlobalMode = mutation({
  args: {
    userId: v.id('users'),
    mode: notificationMode,
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('notificationSettings')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        globalMode: args.mode,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('notificationSettings', {
      userId: args.userId,
      globalMode: args.mode,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const setGroupMode = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    mode: groupNotificationMode,
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    const now = Date.now()
    const existing = await ctx.db
      .query('groupNotificationSettings')
      .withIndex('by_user_group', (q) =>
        q.eq('userId', args.userId).eq('groupId', args.groupId),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        mode: args.mode,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('groupNotificationSettings', {
      userId: args.userId,
      groupId: args.groupId,
      mode: args.mode,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const registerSubscription = mutation({
  args: {
    userId: v.id('users'),
    platform: v.union(v.literal('web'), v.literal('ios'), v.literal('android')),
    tokenOrEndpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptionId = await ctx.db.insert('notificationSubscriptions', {
      userId: args.userId,
      platform: args.platform,
      tokenOrEndpoint: args.tokenOrEndpoint,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      actorId: args.userId,
      entityType: 'notificationSubscription',
      entityId: subscriptionId,
      action: 'notification_subscription.registered',
      after: { platform: args.platform },
    })

    return subscriptionId
  },
})
