import { v } from 'convex/values'

import { action, internalMutation, query } from './_generated/server'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { appendAuditEvent } from './lib/audit'
import {
  attachmentNameMatchesQuestion,
  formatAttachmentSize,
  isImageAttachment,
  selectAttachmentCandidates,
} from './lib/assistantAttachments'
import { emitOperationalEvent } from './lib/observability'
import { rateLimiter } from './lib/rateLimit'
import { authorizeScopedRequest } from './lib/requestAuthorization'

const lowSignalQuestionPattern =
  /^(hi|hello|hey|yo|sup|ok|okay|thanks|thank you|cool|nice|great|good|good good|test|testing)[.!?\s]*$/i

type AssistantEvidence = {
  attachmentId?: Id<'attachments'>
  messageId?: Id<'messages'>
  quote: string
  reason?: string
  ref: string
}

type AssistantAttachmentCandidate = {
  attachmentId: Id<'attachments'>
  contentType: string
  createdAt: number
  filename: string
  kind?: Doc<'attachments'>['kind']
  messageAuthor: string
  messageId: Id<'messages'>
  mode: 'document' | 'image'
  score: number
  size: number
  url: string | null
}

type AssistantMessageContext = { id: string; author: string; body: string; createdAt: number }
type CollectedAssistantContext = {
  attachments: Array<AssistantAttachmentCandidate>
  evidence: Array<AssistantEvidence>
  messages: Array<AssistantMessageContext>
}

function cleanQuestion(question: string) {
  return question.replace(/@track/gi, '').trim() || question.trim()
}

function lowSignalAnswer(question: string) {
  const cleaned = cleanQuestion(question)
  if (!lowSignalQuestionPattern.test(cleaned)) return null
  if (/^(hi|hello|hey|yo|sup)/i.test(cleaned)) {
    return "hey, i'm here. nothing to track from that yet."
  }
  if (/^(thanks|thank you)/i.test(cleaned)) {
    return "anytime."
  }
  return "got it."
}

function isExplicitTaskRequest(question: string) {
  return /@track[\s\S]*\b(create|make|add)\s+(a\s+)?task\b/i.test(question)
}

function scoreAttachment(input: {
  attachment: Doc<'attachments'>
  message: Doc<'messages'>
  messageIndex: number
  messageCount: number
  promptMessageId?: Id<'messages'>
  question: string
}) {
  let score = Math.max(0, input.messageIndex - input.messageCount + 12)
  if (input.promptMessageId && input.message._id === input.promptMessageId) score += 100
  if (attachmentNameMatchesQuestion(input.attachment.filename, input.question)) score += 80
  if (input.message.body && input.question.toLowerCase().includes(input.message.body.toLowerCase().slice(0, 24))) {
    score += 15
  }
  if (input.attachment.kind === 'voice_note') score -= 100
  return score
}

export const listForGroup = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('channel_unavailable')
    const access = await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    const cutoff = access.companyAccess?.entitlement?.exitAt
    return await ctx.db
      .query('assistantStreams')
      .withIndex('by_group_created_at', (q) => cutoff
        ? q.eq('groupId', args.groupId).lte('createdAt', cutoff)
        : q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 20)
  },
})

export const ask = action({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    promptMessageId: v.optional(v.id('messages')),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<{ answer: string; streamId: Id<'assistantStreams'> }> => {
    await ctx.runMutation(internal.assistant.authorizeAsk, {
      groupId: args.groupId,
      requesterId: args.requesterId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    })
    if (process.env.TRACK_TASKS_ENABLED === 'true' && args.promptMessageId && isExplicitTaskRequest(args.question)) {
      const explicit = await ctx.runMutation((internal as any).taskSuggestions.createExplicit, {
        projectId: args.projectId, groupId: args.groupId, requesterId: args.requesterId,
        actingCompanyId: args.actingCompanyId, projectMemberId: args.projectMemberId,
        promptMessageId: args.promptMessageId, question: args.question,
      }) as { status: 'clarify' } | { status: 'ready'; suggestionId: Id<'taskSuggestions'> }
      const now = Date.now()
      const answer = explicit.status === 'ready'
        ? 'I added a grounded task suggestion to the Inbox for human review.'
        : 'I need a concrete action or nearby message before I can suggest a task.'
      const streamId = await ctx.runMutation(internal.assistant.createStream, {
        projectId: args.projectId, groupId: args.groupId, requesterId: args.requesterId,
        actingCompanyId: args.actingCompanyId, requesterProjectMemberId: args.projectMemberId,
        promptMessageId: args.promptMessageId, status: 'completed', answer,
        evidence: [], createdAt: now, updatedAt: now,
      })
      return { answer, streamId }
    }
    const context: CollectedAssistantContext = await ctx.runQuery(api.assistant.collectContext, args)
    const now = Date.now()
    const streamId: Id<'assistantStreams'> = await ctx.runMutation(internal.assistant.createStream, {
      projectId: args.projectId,
      groupId: args.groupId,
      requesterId: args.requesterId,
      actingCompanyId: args.actingCompanyId,
      requesterProjectMemberId: args.projectMemberId,
      promptMessageId: args.promptMessageId,
      status: 'completed',
      answer: '',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    })

    const directAnswer: string | null = context.attachments.length === 0 ? lowSignalAnswer(args.question) : null
    return await ctx.runAction((internal as any).assistantNode.answerStream, {
      context,
      directAnswer,
      groupId: args.groupId,
      projectId: args.projectId,
      question: args.question,
      requesterId: args.requesterId,
      requesterProjectMemberId: args.projectMemberId,
      actingCompanyId: args.actingCompanyId,
      streamId,
    })
  },
})

export const collectContext = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    promptMessageId: v.optional(v.id('messages')),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<CollectedAssistantContext> => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.requesterId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(80)
    const orderedMessages = messages
      .filter((message) => !access.companyAccess?.entitlement?.exitAt || message.createdAt <= access.companyAccess.entitlement.exitAt)
      .reverse()

    const users = await Promise.all(
      Array.from(new Set(orderedMessages.map((message) => message.authorId))).map(
        async (userId) => await ctx.db.get(userId),
      ),
    )
    const userNames = new Map(users.filter((user) => user !== null).map((user) => [user._id, user.displayName]))
    const attachmentDetailsByMessageId = new Map<Id<'messages'>, Array<AssistantAttachmentCandidate>>()
    const attachmentCandidates = (
      await Promise.all(
        orderedMessages.map(async (message, messageIndex) => {
          const messageAttachments = await Promise.all(
            message.attachmentIds.map(async (attachmentId) => {
              const attachment = await ctx.db.get(attachmentId)
              if (!attachment || attachment.projectId !== args.projectId || attachment.groupId !== args.groupId) {
                return null
              }
              const url = await ctx.storage.getUrl(attachment.storageId)
              return {
                attachmentId: attachment._id,
                contentType: attachment.contentType || 'application/octet-stream',
                createdAt: attachment.createdAt,
                filename: attachment.filename,
                kind: attachment.kind,
                messageAuthor: userNames.get(message.authorId) ?? String(message.authorId),
                messageId: message._id,
                mode: isImageAttachment({ contentType: attachment.contentType || 'application/octet-stream' })
                  ? ('image' as const)
                  : ('document' as const),
                score: scoreAttachment({
                  attachment,
                  message,
                  messageCount: orderedMessages.length,
                  messageIndex,
                  promptMessageId: args.promptMessageId,
                  question: args.question,
                }),
                size: attachment.size,
                url,
              }
            }),
          )
          const filteredAttachments = messageAttachments.filter((attachment) => attachment !== null)
          if (filteredAttachments.length > 0) {
            attachmentDetailsByMessageId.set(message._id, filteredAttachments)
          }
          return filteredAttachments
        }),
      )
    ).flat()

    const formattedMessages = await Promise.all(
      orderedMessages.map(async (message) => {
        const bodyParts = [message.body]
        const attachments = attachmentDetailsByMessageId.get(message._id) ?? []
        if (attachments.length > 0) {
          const visibleAttachments = attachments
            .slice(0, 4)
            .map((attachment) =>
              `${attachment.filename} (${attachment.contentType || 'file'}, ${formatAttachmentSize(attachment.size)})`,
            )
          const overflow = attachments.length > visibleAttachments.length
            ? `; ${attachments.length - visibleAttachments.length} more`
            : ''
          bodyParts.push(`Attachments: ${visibleAttachments.join('; ')}${overflow}`)
        }
        if (message.replyToMessageId) {
          const replyToMessage = await ctx.db.get(message.replyToMessageId)
          if (replyToMessage && replyToMessage.groupId === message.groupId) {
            const replyAuthor = await ctx.db.get(replyToMessage.authorId)
            bodyParts.unshift(
              `Replying to ${replyAuthor?.displayName ?? 'Unknown Member'}: ${replyToMessage.body || 'Attachment message'}`,
            )
          }
        }
        const forwardedFrom = message.forwardedFrom
        if (forwardedFrom) {
          const sourceMembership = await ctx.db
            .query('groupMembers')
            .withIndex('by_group_user', (q) =>
              q.eq('groupId', forwardedFrom.sourceGroupId).eq('userId', args.requesterId),
            )
            .unique()
          const sourceGroup = sourceMembership ? await ctx.db.get(forwardedFrom.sourceGroupId) : null
          const sourceLabel = sourceGroup ? ` from ${sourceGroup.name}` : ' from another Group'
          bodyParts.push(
            `Forwarded/copied evidence${sourceLabel}. Original author ${forwardedFrom.originalAuthorName}: ${forwardedFrom.originalBody || 'Attachment message'}`,
          )
        }
        return {
          id: String(message._id),
          author: userNames.get(message.authorId) ?? String(message.authorId),
          body: bodyParts.filter(Boolean).join('\n'),
          createdAt: message.createdAt,
        }
      }),
    )
    return {
      messages: formattedMessages,
      attachments: selectAttachmentCandidates(attachmentCandidates),
      evidence: orderedMessages.map((message, index) => ({
        ref: String(message._id),
        messageId: message._id,
        quote: formattedMessages[index]?.body.slice(0, 220) ?? message.body.slice(0, 220),
        reason: message.forwardedFrom
          ? 'Current Group message containing forwarded/copied evidence.'
          : 'Current Group message.',
      })),
    }
  },
})

export const authorizeAsk = internalMutation({
  args: {
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('channel_unavailable')
    await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.requesterId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'writeChannel')
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
    requesterProjectMemberId: v.optional(v.id('projectMembers')),
    actingCompanyId: v.optional(v.id('companies')),
    promptMessageId: v.optional(v.id('messages')),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('completed'), v.literal('failed')),
    answer: v.string(),
    evidence: v.array(
      v.object({
        attachmentId: v.optional(v.id('attachments')),
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
        attachmentId: v.optional(v.id('attachments')),
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
      actorProjectMemberId: stream.requesterProjectMemberId,
      actingCompanyId: stream.actingCompanyId,
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
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const messages: Array<{ authorId: string; body: string }> = await ctx.runQuery(api.messages.list, {
      groupId: args.groupId,
      userId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
      limit: 40,
    })
    return await ctx.runAction((internal as any).assistantNode.draftModelAnswer, {
      messages: messages.map((message) => ({
        authorId: message.authorId,
        body: message.body,
      })),
      question: args.question,
    })
  },
})
