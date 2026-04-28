import { v } from 'convex/values'

import { action, mutation, query } from './_generated/server'
import { api } from './_generated/api'
import { appendAuditEvent } from './lib/audit'
import { generateTrackText } from './lib/ai'
import { emitOperationalEvent } from './lib/observability'
import { rateLimiter } from './lib/rateLimit'
import { requireGroupMember } from './lib/permissions'

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
}

function answerFromEvidence(question: string, evidence: Array<{ body: string }>) {
  const normalizedQuestion = normalize(question)
  const questionTokens = new Set(
    normalizedQuestion.split(/\s+/).filter((token) => token.length > 3),
  )
  const match = evidence.find((item) =>
    normalize(item.body)
      .split(/\s+/)
      .some((token) => questionTokens.has(token)),
  )

  if (!match) {
    return 'I cannot confirm that from the current conversation. I do not see enough supporting evidence yet.'
  }

  const body = match.body.trim().replace(/\s+/g, ' ')
  const quote = body.length > 140 ? `${body.slice(0, 137)}...` : body
  return `Yes, that is supported by the conversation. The clearest evidence is: "${quote}"`
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

export const ask = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    promptMessageId: v.optional(v.id('messages')),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.requesterId)
    await rateLimiter.limit(ctx, 'askTrack', {
      key: args.requesterId,
      throws: true,
    })
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(80)

    const evidenceSource = messages.slice(0, 5)
    const answer = answerFromEvidence(args.question, evidenceSource)
    const now = Date.now()
    const streamId = await ctx.db.insert('assistantStreams', {
      projectId: args.projectId,
      groupId: args.groupId,
      requesterId: args.requesterId,
      promptMessageId: args.promptMessageId,
      status: 'completed',
      answer,
      evidence: evidenceSource.slice(0, 3).map((message) => ({
        messageId: message._id,
        quote: message.body.slice(0, 220),
        reason: 'Recent group conversation context.',
      })),
      createdAt: now,
      updatedAt: now,
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.requesterId,
      entityType: 'assistantStream',
      entityId: streamId,
      action: 'track_assistant.answered',
      after: {
        questionPreview: args.question.slice(0, 180),
        evidenceCount: evidenceSource.length,
      },
    })

    await emitOperationalEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.requesterId,
      name: 'track_assistant_answered',
      fields: {
        streamId,
        evidenceCount: evidenceSource.length,
      },
    })

    return { streamId, answer }
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
