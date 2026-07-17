import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery, query } from './_generated/server'
import { assertActorMatches, requireAuthenticatedActor } from './lib/actorContext'
import { retryDelayMs } from './lib/pushDelivery'

const sourceKind = v.union(v.literal('message'), v.literal('task'), v.literal('test'))

export const recordEvent = internalMutation({
  args: {
    sourceKind,
    sourceId: v.string(),
    eventKind: v.string(),
    eligibleRecipientCount: v.number(),
    createdIntentCount: v.number(),
    webTargetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('pushNotificationEvents')
      .withIndex('by_source', (q) => q.eq('sourceKind', args.sourceKind).eq('sourceId', args.sourceId))
      .unique()
    if (existing) return existing._id
    return await ctx.db.insert('pushNotificationEvents', {
      ...args,
      eventKind: args.eventKind.slice(0, 80),
      createdAt: Date.now(),
    })
  },
})

export const createIntent = internalMutation({
  args: {
    sourceKind,
    sourceId: v.string(),
    eventKind: v.string(),
    recipientUserId: v.id('users'),
    recipientProjectMemberId: v.optional(v.id('projectMembers')),
    installationId: v.id('pushInstallations'),
    idempotencyKey: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.any(),
    soundEnabled: v.boolean(),
    badge: v.optional(v.number()),
    ttlMs: v.number(),
    deferDispatch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('pushDeliveryIntents')
      .withIndex('by_idempotency', (q) => q.eq('idempotencyKey', args.idempotencyKey))
      .unique()
    if (existing) return existing._id
    const installation = await ctx.db.get(args.installationId)
    if (!installation || !installation.enabled || !installation.expoPushToken ||
      installation.userId !== args.recipientUserId) return null
    const now = Date.now()
    const intentId = await ctx.db.insert('pushDeliveryIntents', {
      sourceKind: args.sourceKind,
      sourceId: args.sourceId,
      eventKind: args.eventKind.slice(0, 80),
      recipientUserId: args.recipientUserId,
      recipientProjectMemberId: args.recipientProjectMemberId,
      installationId: args.installationId,
      idempotencyKey: args.idempotencyKey.slice(0, 300),
      title: args.title.slice(0, 80),
      body: args.body.slice(0, 180),
      data: args.data,
      soundEnabled: args.soundEnabled,
      badge: args.badge,
      status: 'queued',
      attemptCount: 0,
      nextAttemptAt: now,
      expiresAt: now + Math.max(30_000, Math.min(args.ttlMs, 24 * 60 * 60 * 1_000)),
      createdAt: now,
      updatedAt: now,
    })
    if (!args.deferDispatch) {
      await ctx.scheduler.runAfter(0, internal.pushNotifications.dispatchDeliveryIntent, { intentId })
    }
    return intentId
  },
})

export const getIntentForDispatch = internalQuery({
  args: { intentId: v.id('pushDeliveryIntents') },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent) return null
    const installation = await ctx.db.get(intent.installationId)
    return { intent, installation }
  },
})

export const markSending = internalMutation({
  args: { intentId: v.id('pushDeliveryIntents') },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent || !['queued', 'retry_wait'].includes(intent.status)) return null
    const now = Date.now()
    if (intent.expiresAt <= now) {
      await ctx.db.patch(intent._id, { status: 'expired', terminalAt: now, updatedAt: now })
      return null
    }
    await ctx.db.patch(intent._id, {
      status: 'sending',
      attemptCount: intent.attemptCount + 1,
      nextAttemptAt: undefined,
      updatedAt: now,
    })
    return intent.attemptCount + 1
  },
})

export const cancelIntent = internalMutation({
  args: { intentId: v.id('pushDeliveryIntents'), reason: v.string() },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent || ['delivered', 'permanent_failure', 'expired', 'canceled'].includes(intent.status)) return
    const now = Date.now()
    await ctx.db.patch(intent._id, { status: 'canceled', terminalAt: now, updatedAt: now })
    await ctx.db.insert('pushDeliveryAttempts', {
      intentId: intent._id,
      attemptNumber: intent.attemptCount,
      status: 'permanent_failure',
      resultCategory: args.reason.slice(0, 80),
      providerLatencyMs: 0,
      createdAt: now,
      resolvedAt: now,
    })
  },
})

export const recordTicket = internalMutation({
  args: {
    intentId: v.id('pushDeliveryIntents'),
    attemptNumber: v.number(),
    ticketId: v.string(),
    providerLatencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent || intent.status !== 'sending') return
    const now = Date.now()
    await ctx.db.insert('pushDeliveryAttempts', {
      intentId: intent._id,
      attemptNumber: args.attemptNumber,
      status: 'ticket_accepted',
      providerTicketId: args.ticketId,
      resultCategory: 'accepted',
      providerLatencyMs: Math.max(0, args.providerLatencyMs),
      createdAt: now,
    })
    await ctx.db.patch(intent._id, { status: 'ticket_accepted', acceptedAt: now, updatedAt: now })
  },
})

export const recordFailure = internalMutation({
  args: {
    intentId: v.id('pushDeliveryIntents'),
    attemptNumber: v.number(),
    category: v.string(),
    permanent: v.boolean(),
    providerLatencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent || intent.status !== 'sending') return { terminal: true }
    const now = Date.now()
    const canRetry = !args.permanent && args.attemptNumber < 5 && intent.expiresAt > now
    await ctx.db.insert('pushDeliveryAttempts', {
      intentId: intent._id,
      attemptNumber: args.attemptNumber,
      status: canRetry ? 'transient_failure' : 'permanent_failure',
      resultCategory: args.category.slice(0, 80),
      providerLatencyMs: Math.max(0, args.providerLatencyMs),
      createdAt: now,
      resolvedAt: now,
    })
    if (!canRetry) {
      await ctx.db.patch(intent._id, {
        status: intent.expiresAt <= now ? 'expired' : 'permanent_failure',
        terminalAt: now,
        updatedAt: now,
      })
      return { terminal: true }
    }
    const delay = retryDelayMs(args.attemptNumber)
    await ctx.db.patch(intent._id, {
      status: 'retry_wait',
      nextAttemptAt: now + delay,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(delay, internal.pushNotifications.dispatchDeliveryIntent, { intentId: intent._id })
    return { terminal: false }
  },
})

export const listPendingReceipts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const attempts = await ctx.db.query('pushDeliveryAttempts')
      .withIndex('by_status_created_at', (q) =>
        q.eq('status', 'ticket_accepted').lte('createdAt', Date.now() - 15 * 60 * 1_000),
      )
      .order('asc')
      .take(1_000)
    const rows = []
    for (const attempt of attempts) {
      if (!attempt.providerTicketId) continue
      const intent = await ctx.db.get(attempt.intentId)
      if (intent?.status === 'ticket_accepted') rows.push({ attempt, intent })
    }
    return rows
  },
})

export const recoverStaleSendingIntents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const staleBefore = now - 2 * 60 * 1_000
    const candidates = await ctx.db.query('pushDeliveryIntents')
      .withIndex('by_status_next_attempt', (q) => q.eq('status', 'sending'))
      .take(100)
    let recovered = 0
    for (const intent of candidates) {
      if (intent.updatedAt > staleBefore) continue
      if (intent.expiresAt <= now || intent.attemptCount >= 5) {
        await ctx.db.insert('pushDeliveryAttempts', {
          intentId: intent._id,
          attemptNumber: intent.attemptCount,
          status: 'permanent_failure',
          resultCategory: 'interrupted',
          providerLatencyMs: 0,
          createdAt: now,
          resolvedAt: now,
        })
        await ctx.db.patch(intent._id, {
          status: intent.expiresAt <= now ? 'expired' : 'permanent_failure',
          terminalAt: now,
          updatedAt: now,
        })
        continue
      }
      await ctx.db.insert('pushDeliveryAttempts', {
        intentId: intent._id,
        attemptNumber: intent.attemptCount,
        status: 'transient_failure',
        resultCategory: 'interrupted',
        providerLatencyMs: 0,
        createdAt: now,
        resolvedAt: now,
      })
      await ctx.db.patch(intent._id, {
        status: 'retry_wait',
        nextAttemptAt: now,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.pushNotifications.dispatchDeliveryIntent, {
        intentId: intent._id,
      })
      recovered += 1
    }
    return recovered
  },
})

export const resolveReceipt = internalMutation({
  args: {
    attemptId: v.id('pushDeliveryAttempts'),
    delivered: v.boolean(),
    category: v.string(),
    retryable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    if (!attempt || attempt.status !== 'ticket_accepted') return null
    const intent = await ctx.db.get(attempt.intentId)
    if (!intent || intent.status !== 'ticket_accepted') return null
    const now = Date.now()
    const canRetry = !args.delivered && args.retryable && intent.attemptCount < 5 && intent.expiresAt > now
    await ctx.db.patch(attempt._id, {
      status: args.delivered ? 'delivered' : canRetry ? 'transient_failure' : 'permanent_failure',
      resultCategory: args.category.slice(0, 80),
      resolvedAt: now,
    })
    if (canRetry) {
      const delay = retryDelayMs(intent.attemptCount)
      await ctx.db.patch(intent._id, {
        status: 'retry_wait', nextAttemptAt: now + delay, updatedAt: now,
      })
      await ctx.scheduler.runAfter(delay, internal.pushNotifications.dispatchDeliveryIntent, { intentId: intent._id })
      return intent.installationId
    }
    await ctx.db.patch(intent._id, {
      status: args.delivered ? 'delivered' : 'permanent_failure',
      terminalAt: now,
      updatedAt: now,
    })
    return intent.installationId
  },
})

export const expireUnresolvedReceipt = internalMutation({
  args: { attemptId: v.id('pushDeliveryAttempts') },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    if (!attempt || attempt.status !== 'ticket_accepted') return false
    const intent = await ctx.db.get(attempt.intentId)
    if (!intent || intent.status !== 'ticket_accepted') return false
    const now = Date.now()
    if (now - attempt.createdAt < 20 * 60 * 1_000) return false
    await ctx.db.patch(attempt._id, {
      status: 'permanent_failure', resultCategory: 'receipt_expired', resolvedAt: now,
    })
    await ctx.db.patch(intent._id, { status: 'expired', terminalAt: now, updatedAt: now })
    return true
  },
})

export const getDiagnostics = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const recent = await ctx.db.query('pushDeliveryIntents')
      .withIndex('by_created_at').order('desc').take(500)
    const mine = recent.filter((intent) => intent.recipientUserId === args.userId)
    const counts: Record<string, number> = {}
    for (const intent of mine) counts[intent.status] = (counts[intent.status] ?? 0) + 1
    const acceptedLatencies = mine
      .filter((intent) => intent.acceptedAt)
      .map((intent) => intent.acceptedAt! - intent.createdAt)
      .sort((a, b) => a - b)
    const percentile = (p: number) => acceptedLatencies.length
      ? acceptedLatencies[Math.min(acceptedLatencies.length - 1, Math.floor(acceptedLatencies.length * p))]
      : null
    return {
      counts,
      sampleSize: mine.length,
      acceptedLatencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
      opened: mine.filter((intent) => intent.openedAt).length,
      duplicateOpens: mine.reduce((total, intent) => total + (intent.duplicateOpenCount ?? 0), 0),
    }
  },
})

export const getOperationalMetrics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [events, intents] = await Promise.all([
      ctx.db.query('pushNotificationEvents').order('desc').take(1_000),
      ctx.db.query('pushDeliveryIntents').withIndex('by_created_at').order('desc').take(1_000),
    ])
    const counts: Record<string, number> = {}
    for (const intent of intents) counts[intent.status] = (counts[intent.status] ?? 0) + 1
    return {
      events: events.length,
      eligibleRecipients: events.reduce((total, event) => total + event.eligibleRecipientCount, 0),
      createdIntents: events.reduce((total, event) => total + event.createdIntentCount, 0),
      counts,
    }
  },
})
