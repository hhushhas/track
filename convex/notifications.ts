import { v } from 'convex/values'

import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { assertActorMatches, requireAuthenticatedActor } from './lib/actorContext'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { threadsEnabled } from './lib/channelThreadPolicy'

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
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const global = await ctx.db
      .query('notificationSettings')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    const allGroups = await ctx.db
      .query('groupNotificationSettings')
      .withIndex('by_user_group', (q) => q.eq('userId', args.userId))
      .collect()
    const groups = allGroups.filter((setting) => args.projectMemberId
      ? setting.projectMemberId === args.projectMemberId
      : !setting.projectMemberId,
    )
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
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
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
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('channel_unavailable')
    await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    const now = Date.now()
    const existing = args.projectMemberId
      ? await ctx.db.query('groupNotificationSettings').withIndex('by_project_member_group', (q) =>
          q.eq('projectMemberId', args.projectMemberId).eq('groupId', args.groupId),
        ).unique()
      : await ctx.db.query('groupNotificationSettings').withIndex('by_user_group', (q) =>
          q.eq('userId', args.userId).eq('groupId', args.groupId),
        ).unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        mode: args.mode,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('groupNotificationSettings', {
      userId: args.userId,
      projectMemberId: args.projectMemberId,
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
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    console.info('[Track push] registerSubscription called', {
      endpointPrefix: args.endpoint.slice(0, 80),
      platform: args.platform,
      userId: args.userId,
    })
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
      console.info('[Track push] registerSubscription updated existing subscription', {
        endpointPrefix: args.endpoint.slice(0, 80),
        platform: args.platform,
        subscriptionId: existing._id,
        userId: args.userId,
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

    console.info('[Track push] registerSubscription created subscription', {
      endpointPrefix: args.endpoint.slice(0, 80),
      platform: args.platform,
      subscriptionId,
      userId: args.userId,
    })

    return subscriptionId
  },
})

export const registerNativeToken = mutation({
  args: {
    userId: v.id('users'),
    platform: v.union(v.literal('ios'), v.literal('android')),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const token = args.token.trim()
    if (!token) throw new Error('push_token_required')
    const now = Date.now()
    const subscriptions = await ctx.db
      .query('notificationSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    const existing = subscriptions.find(
      (subscription) =>
        subscription.platform === args.platform && subscription.tokenOrEndpoint === token,
    )

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: true,
        updatedAt: now,
      })
      return existing._id
    }

    const subscriptionId = await ctx.db.insert('notificationSubscriptions', {
      userId: args.userId,
      platform: args.platform,
      tokenOrEndpoint: token,
      enabled: true,
      createdAt: now,
      updatedAt: now,
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
    if (message.channelThreadId && !threadsEnabled()) return null
    const [author, group, project, channelThread] = await Promise.all([
      ctx.db.get(message.authorId),
      ctx.db.get(message.groupId),
      ctx.db.get(message.projectId),
      message.channelThreadId ? ctx.db.get(message.channelThreadId) : null,
    ])
    if (!group || !project || (message.channelThreadId && !channelThread)) return null

    const groupMembers = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', message.groupId))
      .collect()

    const targets = await Promise.all(
      groupMembers.map(async (membership) => {
        if (membership.status && membership.status !== 'active') return []
        if (membership.userId === message.authorId) return []

        let projectMemberId = membership.projectMemberId
        if (!projectMemberId) {
          projectMemberId = (await ctx.db
            .query('projectMembers')
            .withIndex('by_project_user', (q) =>
              q.eq('projectId', message.projectId).eq('userId', membership.userId),
            )
            .unique())?._id
        }
        const projectMember = projectMemberId ? await ctx.db.get(projectMemberId) : null
        const mentioned = message.mentions.some((userId) => userId === membership.userId)
        if (message.channelThreadId) {
          if (!projectMemberId) return []
          const follower = await ctx.db
            .query('channelThreadFollowers')
            .withIndex('by_thread_project_member', (q) =>
              q
                .eq('channelThreadId', message.channelThreadId!)
                .eq('projectMemberId', projectMemberId!),
            )
            .unique()
          if (follower?.preference !== 'following' && !mentioned) return []
        }

        if (project.accessProfile === 'company') {
          if (!membership.projectMemberId) return []
          if (!projectMember || projectMember.status !== 'active' || !projectMember.companyId || !projectMember.projectCompanyId) return []
          const [company, companyMember, projectCompany] = await Promise.all([
            ctx.db.get(projectMember.companyId),
            ctx.db.query('companyMembers').withIndex('by_company_user', (q) =>
              q.eq('companyId', projectMember.companyId!).eq('userId', projectMember.userId),
            ).unique(),
            ctx.db.get(projectMember.projectCompanyId),
          ])
          if (!company || company.status !== 'active' || companyMember?.status !== 'active' || projectCompany?.status !== 'active') return []
        }

        const [globalSettings, groupSettings, subscriptions] = await Promise.all([
          ctx.db
            .query('notificationSettings')
            .withIndex('by_user', (q) => q.eq('userId', membership.userId))
            .unique(),
          membership.projectMemberId
            ? ctx.db.query('groupNotificationSettings').withIndex('by_project_member_group', (q) =>
                q.eq('projectMemberId', membership.projectMemberId).eq('groupId', message.groupId),
              ).unique()
            : ctx.db.query('groupNotificationSettings').withIndex('by_user_group', (q) =>
                q.eq('userId', membership.userId).eq('groupId', message.groupId),
              ).unique(),
          ctx.db
            .query('notificationSubscriptions')
            .withIndex('by_user', (q) => q.eq('userId', membership.userId))
            .collect(),
        ])

        const shouldNotify = shouldNotifyForMessage({
          globalMode: globalSettings?.globalMode ?? 'mentions',
          groupMode: groupSettings?.mode ?? 'inherit',
          mentioned,
        })
        if (!shouldNotify) return []

        return subscriptions
          .filter((subscription) => subscription.enabled)
          .map((subscription) => ({
            actingCompanyId: projectMember?.companyId,
            id: subscription._id,
            platform: subscription.platform,
            projectMemberId,
            tokenOrEndpoint: subscription.tokenOrEndpoint,
          }))
      }),
    )

    return {
      body: message.body || message.notificationPreview || 'Sent an attachment.',
      channelThreadId: message.channelThreadId,
      channelThreadName: channelThread?.name,
      groupId: message.groupId,
      groupName: group.name,
      projectId: message.projectId,
      projectName: project.name,
      senderName: author?.displayName ?? 'Track',
      targets: Array.from(new Map(targets.flat().map((target) => [
        `${target.id}:${target.projectMemberId ?? 'legacy'}`,
        target,
      ])).values()),
      url: message.channelThreadId
        ? `/workspace/projects/${message.projectId}/groups/${message.groupId}/threads/${message.channelThreadId}#message-${message._id}`
        : `/workspace/projects/${message.projectId}/groups/${message.groupId}`,
    }
  },
})

export const collectUserNotificationTargets = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const subscriptions = await ctx.db
      .query('notificationSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    return subscriptions
      .filter((subscription) => subscription.enabled)
      .map((subscription) => ({
        id: subscription._id,
        platform: subscription.platform,
        tokenOrEndpoint: subscription.tokenOrEndpoint,
      }))
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
