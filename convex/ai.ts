import { v } from 'convex/values'

import { action, internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx, QueryCtx } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { generateTrackText } from './lib/ai'
import { emitOperationalEvent } from './lib/observability'
import { rateLimiter } from './lib/rateLimit'
import { requireGroupMember, requireReviewer } from './lib/permissions'

const recordTypeValues = ['task', 'scope_change', 'decision', 'action_item', 'blocker', 'question'] as const
const recordStatusValues = ['open', 'in_progress', 'blocked', 'done'] as const
const recordTypes = new Set<string>(recordTypeValues)
const recordStatuses = new Set<string>(recordStatusValues)

function normalizeType(value: unknown): (typeof recordTypeValues)[number] {
  return typeof value === 'string' && recordTypes.has(value)
    ? (value as (typeof recordTypeValues)[number])
    : 'task'
}

function normalizeStatus(value: unknown): (typeof recordStatusValues)[number] {
  return typeof value === 'string' && recordStatuses.has(value)
    ? (value as (typeof recordStatusValues)[number])
    : 'open'
}

function inferDraftType(body: string): (typeof recordTypeValues)[number] {
  const text = body.toLowerCase()
  if (text.includes('block') || text.includes('blocked')) return 'blocker'
  if (text.includes('decision') || text.includes('decide')) return 'decision'
  if (text.includes('scope') || text.includes('feature') || text.includes('change')) {
    return 'scope_change'
  }
  if (text.includes('question') || text.includes('?')) return 'question'
  if (text.includes('todo') || text.includes('action')) return 'action_item'
  return 'task'
}

function summarizeMessage(body: string) {
  const trimmed = body.trim().replace(/\s+/g, ' ')
  return trimmed.length > 110 ? `${trimmed.slice(0, 107)}...` : trimmed
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function reviewPrompt(input: {
  groupName: string
  messages: Array<{ id: string; author: string; body: string; createdAt: number }>
  records: Array<{ title: string; description: string; classification: string; status: string }>
  drafts: Array<{ title: string; description: string; type: string }>
}) {
  return [
    'You are Track AI Review. Extract reviewable project records from group chat evidence.',
    'Return ONLY JSON. No markdown.',
    'Create draft records only for concrete project-relevant items: decisions, tasks, action items, scope changes, blockers, or questions.',
    'Do not duplicate existing records or unresolved drafts. Do not invent facts.',
    'Each draft must cite source message ids from the supplied messages.',
    'Schema:',
    '{"summary":"string","drafts":[{"type":"task|scope_change|decision|action_item|blocker|question","title":"string","description":"string","proposedStatus":"open|in_progress|blocked|done","sourceMessageIds":["messageId"],"ownerRef":"messageId or empty","evidence":[{"messageId":"messageId","quote":"short exact quote","reason":"why this supports the draft"}]}]}',
    '',
    `Group: ${input.groupName}`,
    '',
    'Existing reviewed records:',
    input.records.length
      ? input.records
          .map(
            (record) =>
              `- ${record.title} (${record.classification}, ${record.status}): ${record.description}`,
          )
          .join('\n')
      : 'None.',
    '',
    'Unresolved drafts:',
    input.drafts.length
      ? input.drafts
          .map((draft) => `- ${draft.title} (${draft.type}): ${draft.description}`)
          .join('\n')
      : 'None.',
    '',
    'Messages:',
    input.messages.length
      ? input.messages
          .map((message) => `[${message.id}] ${message.author}: ${message.body}`)
          .join('\n')
      : 'No messages.',
  ].join('\n')
}

function fallbackDrafts(messages: Array<{ id: Id<'messages'>; authorId: Id<'users'>; body: string }>) {
  return messages
    .filter((message) => {
      const body = message.body.toLowerCase()
      return (
        body.includes('please') ||
        body.includes('need') ||
        body.includes('feature') ||
        body.includes('change') ||
        body.includes('scope') ||
        body.includes('blocked') ||
        body.includes('?') ||
        body.includes('@track')
      )
    })
    .slice(0, 5)
    .map((message) => {
      const title = summarizeMessage(message.body)
      return {
        type: inferDraftType(message.body),
        title,
        description: `Track inferred this from the conversation: ${title}`,
        proposedStatus: 'open' as const,
        proposedOwnerMessageId: message.id,
        sourceMessageIds: [message.id],
        evidence: [
          {
            messageId: message.id,
            quote: summarizeMessage(message.body),
            reason: 'Conversation message matched Track review criteria.',
          },
        ],
      }
    })
}

function normalizeDrafts(
  raw: unknown,
  messages: Array<{ id: Id<'messages'>; authorId: Id<'users'>; body: string }>,
) {
  const messageById = new Map(messages.map((message) => [message.id, message]))
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { drafts?: unknown }).drafts)) {
    return fallbackDrafts(messages)
  }

  const drafts = (raw as { drafts: Array<Record<string, unknown>> }).drafts
    .slice(0, 12)
    .map((draft) => {
      const sourceMessageIds = Array.isArray(draft.sourceMessageIds)
        ? draft.sourceMessageIds.filter(
            (messageId): messageId is Id<'messages'> =>
              typeof messageId === 'string' && messageById.has(messageId as Id<'messages'>),
          )
        : []
      if (!sourceMessageIds.length) return null
      const evidence = Array.isArray(draft.evidence)
        ? draft.evidence
            .map((item) => {
              if (!item || typeof item !== 'object') return null
              const evidenceItem = item as Record<string, unknown>
              if (
                typeof evidenceItem.messageId !== 'string' ||
                !messageById.has(evidenceItem.messageId as Id<'messages'>)
              ) {
                return null
              }
              const messageId = evidenceItem.messageId as Id<'messages'>
              return {
                messageId,
                quote:
                  typeof evidenceItem.quote === 'string'
                    ? evidenceItem.quote.slice(0, 220)
                    : summarizeMessage(messageById.get(messageId)?.body ?? ''),
                reason:
                  typeof evidenceItem.reason === 'string'
                    ? evidenceItem.reason.slice(0, 180)
                    : 'Model-cited source message.',
              }
            })
            .filter((item) => item !== null)
        : []
      return {
        type: normalizeType(draft.type),
        title:
          typeof draft.title === 'string' && draft.title.trim()
            ? draft.title.trim().slice(0, 160)
            : summarizeMessage(messageById.get(sourceMessageIds[0])?.body ?? 'Review item'),
        description:
          typeof draft.description === 'string' && draft.description.trim()
            ? draft.description.trim().slice(0, 1000)
            : 'Track extracted this from the conversation.',
        proposedStatus: normalizeStatus(draft.proposedStatus),
        proposedOwnerMessageId:
          typeof draft.ownerRef === 'string' && messageById.has(draft.ownerRef as Id<'messages'>)
            ? (draft.ownerRef as Id<'messages'>)
            : sourceMessageIds[0],
        sourceMessageIds,
        evidence:
          evidence.length > 0
            ? evidence
            : sourceMessageIds.slice(0, 3).map((messageId) => ({
                messageId,
                quote: summarizeMessage(messageById.get(messageId)?.body ?? ''),
                reason: 'Source message used by Track review.',
              })),
      }
    })
    .filter((draft) => draft !== null)

  return drafts.length ? drafts : fallbackDrafts(messages)
}

export const latestForGroup = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.db
      .query('aiReviews')
      .withIndex('by_group_started_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .first()
  },
})

export const runReviewNow = action({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewerId: v.id('users'),
  },
  handler: async (ctx, args): Promise<{ reviewId: Id<'aiReviews'>; draftCount: number; summary: string }> => {
    await ctx.runMutation(internal.ai.authorizeManualReview, args)
    const context = await ctx.runQuery(internal.ai.collectManualReviewContext, args)
    return await runReviewWithContext(ctx, {
      ...context,
      actorId: args.reviewerId,
      trigger: 'manual',
      incremental: false,
    })
  },
})

export const runScheduledReviews = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    reviewed: number
    results: Array<{ reviewId: Id<'aiReviews'>; draftCount: number; summary: string }>
  }> => {
    const dueGroups: Array<{ projectId: Id<'projects'>; groupId: Id<'groups'> }> = await ctx.runQuery(
      internal.ai.listGroupsDueForReview,
      {},
    )
    const results: Array<{ reviewId: Id<'aiReviews'>; draftCount: number; summary: string }> = []
    for (const dueGroup of dueGroups) {
      const context = await ctx.runQuery(internal.ai.collectScheduledReviewContext, {
        projectId: dueGroup.projectId,
        groupId: dueGroup.groupId,
      })
      if (!context.messages.length) continue
      results.push(
        await runReviewWithContext(ctx, {
          ...context,
          trigger: 'scheduled',
          incremental: true,
        }),
      )
    }
    return { reviewed: results.length, results }
  },
})

async function runReviewWithContext(
  ctx: ActionCtx,
  input: {
    projectId: Id<'projects'>
    groupId: Id<'groups'>
    groupName: string
    actorId?: Id<'users'>
    trigger: 'manual' | 'scheduled'
    incremental: boolean
    messages: Array<{ id: Id<'messages'>; authorId: Id<'users'>; author: string; body: string; createdAt: number }>
    records: Array<{ title: string; description: string; classification: string; status: string }>
    drafts: Array<{ title: string; description: string; type: string }>
  },
) {
  const startedAt = Date.now()
  const reviewId: Id<'aiReviews'> = await ctx.runMutation(internal.ai.startReview, {
    projectId: input.projectId,
    groupId: input.groupId,
    trigger: input.trigger,
  })

  try {
    const result = await generateTrackText(
      reviewPrompt({
        groupName: input.groupName,
        messages: input.messages,
        records: input.records,
        drafts: input.drafts,
      }),
    )
    const parsed = extractJsonObject(result.text)
    const normalizedDrafts = normalizeDrafts(parsed, input.messages)
    const summary =
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { summary?: unknown }).summary === 'string'
        ? (parsed as { summary: string }).summary
        : normalizedDrafts.length
          ? `Track found ${normalizedDrafts.length} conversation items that may need review.`
          : 'Track did not find new review-worthy items in the recent conversation.'

    await ctx.runMutation(internal.ai.completeReview, {
      projectId: input.projectId,
      groupId: input.groupId,
      reviewId,
      actorId: input.actorId,
      model: result.model,
      durationMs: Date.now() - startedAt,
      inputMessageCount: input.messages.length,
      summary,
      lastReviewedMessageId: input.messages.at(-1)?.id,
      drafts: normalizedDrafts,
    })
    return { reviewId, draftCount: normalizedDrafts.length, summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ai_review_failed'
    await ctx.runMutation(internal.ai.failReview, {
      projectId: input.projectId,
      groupId: input.groupId,
      reviewId,
      actorId: input.actorId,
      error: message,
      durationMs: Date.now() - startedAt,
    })
    throw error
  }
}

export const collectManualReviewContext = internalQuery({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.reviewerId)
    await requireGroupMember(ctx, args.groupId, args.reviewerId)
    return await collectReviewContext(ctx, args.projectId, args.groupId, false)
  },
})

export const authorizeManualReview = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.reviewerId)
    await requireGroupMember(ctx, args.groupId, args.reviewerId)
    await rateLimiter.limit(ctx, 'runAiReview', {
      key: args.groupId,
      throws: true,
    })
  },
})

export const collectScheduledReviewContext = internalQuery({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
  },
  handler: async (ctx, args) => {
    return await collectReviewContext(ctx, args.projectId, args.groupId, true)
  },
})

export const listGroupsDueForReview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query('groups').collect()
    const now = Date.now()
    const due = []
    for (const group of groups) {
      const settings = group.aiReviewSettings ?? { enabled: true, frequencyMinutes: 30 }
      if (!settings.enabled) continue
      const latestReview = await ctx.db
        .query('aiReviews')
        .withIndex('by_group_started_at', (q) => q.eq('groupId', group._id))
        .order('desc')
        .first()
      const lastRun = latestReview?.finishedAt ?? latestReview?.startedAt ?? 0
      if (now - lastRun < settings.frequencyMinutes * 60 * 1000) continue
      due.push({ projectId: group.projectId, groupId: group._id })
    }
    return due.slice(0, 20)
  },
})

async function collectReviewContext(
  ctx: QueryCtx,
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  incremental: boolean,
) {
  const group = await ctx.db.get(groupId)
  if (!group || group.projectId !== projectId) throw new Error('group_not_found')
  const latestReview = await ctx.db
    .query('aiReviews')
    .withIndex('by_group_started_at', (q) => q.eq('groupId', groupId))
    .order('desc')
    .first()
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_group_created_at', (q) => q.eq('groupId', groupId))
    .order('desc')
    .take(incremental ? 120 : 240)
  const orderedMessages = messages
    .reverse()
    .filter((message) =>
      incremental && latestReview?.lastReviewedAt
        ? message.createdAt > latestReview.lastReviewedAt
        : true,
    )
  const users = await Promise.all(
    Array.from(new Set(orderedMessages.map((message) => message.authorId))).map(
      async (userId) => await ctx.db.get(userId),
    ),
  )
  const userNames = new Map(users.filter((user) => user !== null).map((user) => [user._id, user.displayName]))
  const records = await ctx.db
    .query('records')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const drafts = await ctx.db
    .query('draftRecords')
    .withIndex('by_group_status', (q) => q.eq('groupId', groupId).eq('status', 'pending'))
    .collect()

  return {
    projectId,
    groupId,
    groupName: group.name,
    messages: orderedMessages.map((message) => ({
      id: message._id,
      authorId: message.authorId,
      author: userNames.get(message.authorId) ?? String(message.authorId),
      body: message.body,
      createdAt: message.createdAt,
    })),
    records: records.map((record) => ({
      title: record.title,
      description: record.description,
      classification: record.classification,
      status: record.status,
    })),
    drafts: drafts.map((draft) => ({
      title: draft.title,
      description: draft.description,
      type: draft.type,
    })),
  }
}

export const startReview = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    trigger: v.union(v.literal('manual'), v.literal('scheduled')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('aiReviews', {
      projectId: args.projectId,
      groupId: args.groupId,
      trigger: args.trigger,
      status: 'running',
      startedAt: Date.now(),
      model: 'anthropic/claude-sonnet-4.6',
    })
  },
})

export const completeReview = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewId: v.id('aiReviews'),
    actorId: v.optional(v.id('users')),
    model: v.string(),
    durationMs: v.number(),
    inputMessageCount: v.number(),
    summary: v.string(),
    lastReviewedMessageId: v.optional(v.id('messages')),
    drafts: v.array(
      v.object({
        type: v.union(
          v.literal('task'),
          v.literal('scope_change'),
          v.literal('decision'),
          v.literal('action_item'),
          v.literal('blocker'),
          v.literal('question'),
        ),
        title: v.string(),
        description: v.string(),
        proposedStatus: v.union(
          v.literal('open'),
          v.literal('in_progress'),
          v.literal('blocked'),
          v.literal('done'),
        ),
        proposedOwnerMessageId: v.optional(v.id('messages')),
        sourceMessageIds: v.array(v.id('messages')),
        evidence: v.array(
          v.object({
            messageId: v.id('messages'),
            quote: v.string(),
            reason: v.optional(v.string()),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const draft of args.drafts) {
      const ownerMessage = draft.proposedOwnerMessageId
        ? await ctx.db.get(draft.proposedOwnerMessageId)
        : null
      await ctx.db.insert('draftRecords', {
        projectId: args.projectId,
        groupId: args.groupId,
        aiReviewId: args.reviewId,
        sourceMessageIds: draft.sourceMessageIds,
        type: draft.type,
        title: draft.title,
        description: draft.description,
        proposedStatus: draft.proposedStatus,
        proposedOwnerId: ownerMessage?.authorId,
        evidence: draft.evidence,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.patch(args.reviewId, {
      status: 'completed',
      finishedAt: now,
      lastReviewedMessageId: args.lastReviewedMessageId,
      lastReviewedAt: now,
      model: args.model,
      summary: args.summary,
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.actorId,
      entityType: 'aiReview',
      entityId: args.reviewId,
      action: 'ai_review.completed',
      after: {
        draftCount: args.drafts.length,
        model: args.model,
        durationMs: args.durationMs,
        inputMessageCount: args.inputMessageCount,
      },
    })

    await emitOperationalEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.actorId,
      name: 'ai_review_completed',
      fields: {
        reviewId: args.reviewId,
        draftCount: args.drafts.length,
        model: args.model,
        durationMs: args.durationMs,
        inputMessageCount: args.inputMessageCount,
      },
    })
  },
})

export const failReview = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewId: v.id('aiReviews'),
    actorId: v.optional(v.id('users')),
    error: v.string(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reviewId, {
      status: 'failed',
      finishedAt: Date.now(),
      error: args.error,
    })
    await emitOperationalEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.actorId,
      name: 'ai_review_failed',
      fields: {
        reviewId: args.reviewId,
        error: args.error,
        durationMs: args.durationMs,
      },
    })
  },
})
