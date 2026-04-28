import { v } from 'convex/values'

import { internalMutation, internalQuery, mutation, query } from './_generated/server'
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

function shouldNotifyForMessage(input: {
  globalMode: 'all' | 'mentions' | 'none'
  groupMode: 'inherit' | 'all' | 'mentions' | 'none'
  mentioned: boolean
}) {
  const mode = input.groupMode === 'inherit' ? input.globalMode : input.groupMode
  if (mode === 'none') return false
  if (mode === 'all') return true
  return input.mentioned
}

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

export const getWebPushPublicKey = query({
  args: {},
  handler: () => process.env.VAPID_PUBLIC_KEY ?? null,
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
    endpoint: v.string(),
    expirationTime: v.optional(v.number()),
    keys: v.object({
      auth: v.string(),
      p256dh: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const tokenOrEndpoint = JSON.stringify({
      endpoint: args.endpoint,
      expirationTime: args.expirationTime ?? null,
      keys: args.keys,
    })
    const existingSubscriptions = await ctx.db
      .query('notificationSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    const existing = existingSubscriptions.find((subscription) => {
      try {
        return JSON.parse(subscription.tokenOrEndpoint).endpoint === args.endpoint
      } catch {
        return subscription.tokenOrEndpoint === args.endpoint
      }
    })

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: true,
        platform: args.platform,
        tokenOrEndpoint,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    const subscriptionId = await ctx.db.insert('notificationSubscriptions', {
      userId: args.userId,
      platform: args.platform,
      tokenOrEndpoint,
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

export const collectMessageNotificationTargets = internalQuery({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (!message) return null
    const [author, group, project] = await Promise.all([
      ctx.db.get(message.authorId),
      ctx.db.get(message.groupId),
      ctx.db.get(message.projectId),
    ])
    if (!group || !project) return null

    const groupMembers = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', message.groupId))
      .collect()

    const targets = await Promise.all(
      groupMembers.map(async (membership) => {
        if (membership.userId === message.authorId) return []

        const [globalSettings, groupSettings, subscriptions] = await Promise.all([
          ctx.db
            .query('notificationSettings')
            .withIndex('by_user', (q) => q.eq('userId', membership.userId))
            .unique(),
          ctx.db
            .query('groupNotificationSettings')
            .withIndex('by_user_group', (q) =>
              q.eq('userId', membership.userId).eq('groupId', message.groupId),
            )
            .unique(),
          ctx.db
            .query('notificationSubscriptions')
            .withIndex('by_user', (q) => q.eq('userId', membership.userId))
            .collect(),
        ])

        const shouldNotify = shouldNotifyForMessage({
          globalMode: globalSettings?.globalMode ?? 'mentions',
          groupMode: groupSettings?.mode ?? 'inherit',
          mentioned: message.mentions.some((userId) => userId === membership.userId),
        })
        if (!shouldNotify) return []

        return subscriptions
          .filter((subscription) => subscription.enabled && subscription.platform === 'web')
          .map((subscription) => ({
            id: subscription._id,
            tokenOrEndpoint: subscription.tokenOrEndpoint,
          }))
      }),
    )

    return {
      body: message.body,
      groupName: group.name,
      projectName: project.name,
      senderName: author?.displayName ?? 'Track',
      targets: targets.flat(),
      url: `/workspace/projects/${message.projectId}/groups/${message.groupId}`,
    }
  },
})

export const disableSubscription = internalMutation({
  args: {
    subscriptionId: v.id('notificationSubscriptions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      enabled: false,
      updatedAt: Date.now(),
    })
  },
})
