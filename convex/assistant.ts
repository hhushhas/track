import { v } from 'convex/values'

import { action, internalMutation, query } from './_generated/server'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { appendAuditEvent } from './lib/audit'
import { generateTrackText } from './lib/ai'
import { emitOperationalEvent } from './lib/observability'
import { rateLimiter } from './lib/rateLimit'
import { requireGroupMember } from './lib/permissions'

const citationPattern = /\[([a-z0-9]+)\]/gi

function cleanQuestion(question: string) {
  return question.replace(/@track/gi, '').trim() || question.trim()
}

function extractCitations(answer: string) {
  return Array.from(new Set(Array.from(answer.matchAll(citationPattern)).map((match) => match[1])))
}

function answerPrompt(input: {
  question: string
  messages: Array<{ id: string; author: string; body: string; createdAt: number }>
  records: Array<{ id: string; title: string; description: string; classification: string; status: string }>
  drafts: Array<{ id: string; title: string; description: string; type: string }>
}) {
  return [
    'You are Track Assistant, an evidence-grounded project chat assistant.',
    'Answer only from the supplied evidence. If the evidence is insufficient, say so plainly.',
    'Use natural posture: yes, no, partly, or not enough evidence. Do not judge intent.',
    'Cite factual claims with bracket citations like [messageId] or [recordId].',
    'If the answer reveals a decision, task, blocker, or scope-relevant item, end with a short offer to create a Draft Record.',
    '',
    `Question: ${cleanQuestion(input.question)}`,
    '',
    'Current Group messages:',
    input.messages.length
      ? input.messages
          .map((message) => `[${message.id}] ${message.author}: ${message.body}`)
          .join('\n')
      : 'No messages available.',
    '',
    'Accessible Project Records:',
    input.records.length
      ? input.records
          .map(
            (record) =>
              `[${record.id}] ${record.title} (${record.classification}, ${record.status}): ${record.description}`,
          )
          .join('\n')
      : 'No reviewed records available.',
    '',
    'Unresolved Draft Records:',
    input.drafts.length
      ? input.drafts
          .map((draft) => `[${draft.id}] ${draft.title} (${draft.type}): ${draft.description}`)
          .join('\n')
      : 'No unresolved drafts available.',
  ].join('\n')
}

export const listForGroup = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.db
      .query('assistantStreams')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 20)
  },
})

export const ask = action({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    promptMessageId: v.optional(v.id('messages')),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.assistant.authorizeAsk, {
      groupId: args.groupId,
      requesterId: args.requesterId,
    })
    const context = await ctx.runQuery(api.assistant.collectContext, args)
    const now = Date.now()
    const streamId: Id<'assistantStreams'> = await ctx.runMutation(internal.assistant.createStream, {
      projectId: args.projectId,
      groupId: args.groupId,
      requesterId: args.requesterId,
      promptMessageId: args.promptMessageId,
      status: 'completed',
      answer: '',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    })

    try {
      const startedAt = Date.now()
      await ctx.runMutation(internal.assistant.updateStreamStatus, {
        streamId,
        status: 'running',
      })
      const result = await generateTrackText(
        answerPrompt({
          question: args.question,
          messages: context.messages,
          records: context.records,
          drafts: context.drafts,
        }),
      )
      const citedIds = extractCitations(result.text)
      const evidence = context.evidence
        .filter((item: { ref: string }) => citedIds.includes(item.ref))
        .slice(0, 8)
        .map((item: { messageId?: Id<'messages'>; quote: string; reason?: string }) => ({
          messageId: item.messageId,
          quote: item.quote,
          reason: item.reason,
        }))
      const fallbackEvidence = evidence.length
        ? evidence
        : context.evidence.slice(0, 3).map((item: { messageId?: Id<'messages'>; quote: string; reason?: string }) => ({
            messageId: item.messageId,
            quote: item.quote,
            reason: item.reason,
          }))

      await ctx.runMutation(internal.assistant.completeStream, {
        streamId,
        answer: result.text,
        evidence: fallbackEvidence,
        model: result.model,
        durationMs: Date.now() - startedAt,
        retrievalScope: 'current_group_plus_accessible_project_records',
      })
      return { streamId, answer: result.text }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'assistant_failed'
      await ctx.runMutation(internal.assistant.failStream, {
        streamId,
        error: message,
      })
      return {
        streamId,
        answer: 'Track could not complete that answer. Please try again in a moment.',
      }
    }
  },
})

export const collectContext = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    promptMessageId: v.optional(v.id('messages')),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.requesterId)

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(80)
    const orderedMessages = messages.reverse()

    const groupMemberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.requesterId))
      .collect()
    const visibleGroupIds = new Set(
      groupMemberships
        .filter((membership) => membership.projectId === args.projectId)
        .map((membership) => membership.groupId),
    )
    const records = (
      await ctx.db
        .query('records')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect()
    )
      .filter((record) => visibleGroupIds.has(record.groupId))
      .slice(-40)
    const drafts = (
      await ctx.db
        .query('draftRecords')
        .withIndex('by_project_status', (q) => q.eq('projectId', args.projectId))
        .collect()
    )
      .filter((draft) => draft.status === 'pending' && visibleGroupIds.has(draft.groupId))
      .slice(-20)

    const users = await Promise.all(
      Array.from(new Set(orderedMessages.map((message) => message.authorId))).map(
        async (userId) => await ctx.db.get(userId),
      ),
    )
    const userNames = new Map(users.filter((user) => user !== null).map((user) => [user._id, user.displayName]))

    const formattedMessages = orderedMessages.map((message) => ({
      id: String(message._id),
      author: userNames.get(message.authorId) ?? String(message.authorId),
      body: message.body,
      createdAt: message.createdAt,
    }))
    const formattedRecords = records.map((record) => ({
      id: String(record._id),
      title: record.title,
      description: record.description,
      classification: record.classification,
      status: record.status,
    }))
    const formattedDrafts = drafts.map((draft) => ({
      id: String(draft._id),
      title: draft.title,
      description: draft.description,
      type: draft.type,
    }))

    return {
      messages: formattedMessages,
      records: formattedRecords,
      drafts: formattedDrafts,
      evidence: [
        ...orderedMessages.map((message) => ({
          ref: String(message._id),
          messageId: message._id,
          quote: message.body.slice(0, 220),
          reason: 'Current Group message.',
        })),
        ...records.map((record) => ({
          ref: String(record._id),
          quote: `${record.title}: ${record.description}`.slice(0, 220),
          reason: 'Accessible Project Record.',
        })),
        ...drafts.map((draft) => ({
          ref: String(draft._id),
          quote: `${draft.title}: ${draft.description}`.slice(0, 220),
          reason: 'Unresolved Draft Record.',
        })),
      ],
    }
  },
})

export const authorizeAsk = internalMutation({
  args: {
    groupId: v.id('groups'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.requesterId)
    await rateLimiter.limit(ctx, 'askTrack', {
      key: args.requesterId,
      throws: true,
    })
  },
})

export const createStream = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    promptMessageId: v.optional(v.id('messages')),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('completed'), v.literal('failed')),
    answer: v.string(),
    evidence: v.array(
      v.object({
        messageId: v.optional(v.id('messages')),
        quote: v.string(),
        reason: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const streamId = await ctx.db.insert('assistantStreams', args)
    if (args.promptMessageId) {
      await ctx.db.patch(args.promptMessageId, {
        trackInvocationId: streamId,
      })
    }
    return streamId
  },
})

export const updateStreamStatus = internalMutation({
  args: {
    streamId: v.id('assistantStreams'),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('completed'), v.literal('failed')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.streamId, {
      status: args.status,
      updatedAt: Date.now(),
    })
  },
})

export const completeStream = internalMutation({
  args: {
    streamId: v.id('assistantStreams'),
    answer: v.string(),
    evidence: v.array(
      v.object({
        messageId: v.optional(v.id('messages')),
        quote: v.string(),
        reason: v.optional(v.string()),
      }),
    ),
    model: v.string(),
    durationMs: v.number(),
    retrievalScope: v.string(),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.streamId)
    if (!stream) throw new Error('assistant_stream_not_found')
    await ctx.db.patch(args.streamId, {
      status: 'completed',
      answer: args.answer,
      evidence: args.evidence,
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: stream.projectId,
      groupId: stream.groupId,
      actorId: stream.requesterId,
      entityType: 'assistantStream',
      entityId: args.streamId,
      action: 'track_assistant.answered',
      after: {
        evidenceCount: args.evidence.length,
        model: args.model,
        durationMs: args.durationMs,
        retrievalScope: args.retrievalScope,
      },
    })

    await emitOperationalEvent(ctx, {
      projectId: stream.projectId,
      groupId: stream.groupId,
      actorId: stream.requesterId,
      name: 'track_assistant_answered',
      fields: {
        streamId: args.streamId,
        evidenceCount: args.evidence.length,
        model: args.model,
        durationMs: args.durationMs,
        retrievalScope: args.retrievalScope,
      },
    })
  },
})

export const failStream = internalMutation({
  args: {
    streamId: v.id('assistantStreams'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.streamId)
    if (!stream) throw new Error('assistant_stream_not_found')
    await ctx.db.patch(args.streamId, {
      status: 'failed',
      answer: 'Track could not complete that answer. Please try again in a moment.',
      updatedAt: Date.now(),
    })
    await emitOperationalEvent(ctx, {
      projectId: stream.projectId,
      groupId: stream.groupId,
      actorId: stream.requesterId,
      name: 'track_assistant_failed',
      fields: {
        streamId: args.streamId,
        error: args.error,
      },
    })
  },
})

export const draftModelAnswer = action({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const messages: Array<{ authorId: string; body: string }> = await ctx.runQuery(api.messages.list, {
      groupId: args.groupId,
      userId: args.userId,
      limit: 40,
    })
    const transcript = messages
      .reverse()
      .map((message: { authorId: string; body: string }) => `${message.authorId}: ${message.body}`)
      .join('\n')
    const result = await generateTrackText(
      [
        'You are Track Assistant. Answer naturally with yes/no when supported.',
        'Use only the supplied conversation evidence. If evidence is insufficient, say so.',
        '',
        `Question: ${args.question}`,
        '',
        `Conversation:\n${transcript}`,
      ].join('\n'),
    )
    return result.text
  },
})
