import { v } from 'convex/values'

import { action, internalMutation, query } from './_generated/server'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { appendAuditEvent } from './lib/audit'
import { generateTrackDocumentNotes, generateTrackText } from './lib/ai'
import { extractAttachmentText, formatExtractedAttachmentNote } from './lib/attachmentTextExtraction'
import {
  attachmentNameMatchesQuestion,
  attachmentReaderQuestion,
  compactText,
  formatAttachmentSize,
  isImageAttachment,
  maxDocumentReaderBytes,
  maxImageBytes,
  selectAttachmentCandidates,
} from './lib/assistantAttachments'
import { emitOperationalEvent } from './lib/observability'
import { rateLimiter } from './lib/rateLimit'
import { requireGroupMember } from './lib/permissions'
import type { ModelMessage } from 'ai'

const citationPattern = /\[([a-z0-9]+)\]/gi
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

type LoadedAttachment =
  | { data: Uint8Array; ok: true }
  | { ok: false; reason: string }

type AssistantMessageContext = { id: string; author: string; body: string; createdAt: number }
type AssistantRecordContext = {
  id: string
  title: string
  description: string
  classification: string
  status: string
}
type AssistantDraftContext = { id: string; title: string; description: string; type: string }
type AssistantMemoryContext = {
  boxId: string | null
  content: string
  lastContextUpdatedAt?: number
  loaded: boolean
  reason?: string
}

type CollectedAssistantContext = {
  attachments: Array<AssistantAttachmentCandidate>
  drafts: Array<AssistantDraftContext>
  evidence: Array<AssistantEvidence>
  messages: Array<AssistantMessageContext>
  records: Array<AssistantRecordContext>
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
    return "anytime. no record needed for that."
  }
  return "got it. nothing to track from that on its own."
}

function extractCitations(answer: string) {
  return Array.from(new Set(Array.from(answer.matchAll(citationPattern)).map((match) => match[1])))
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

async function fetchAttachmentBytes(attachment: AssistantAttachmentCandidate, maxBytes: number): Promise<LoadedAttachment> {
  if (!attachment.url) return { ok: false, reason: 'no storage URL available' }
  const response = await fetch(attachment.url)
  if (!response.ok) return { ok: false, reason: `download failed with ${response.status}` }
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > maxBytes) return { ok: false, reason: `file is larger than ${formatAttachmentSize(maxBytes)}` }
  const data = new Uint8Array(await response.arrayBuffer())
  if (data.byteLength > maxBytes) return { ok: false, reason: `file is larger than ${formatAttachmentSize(maxBytes)}` }
  return { ok: true, data }
}

function formatAttachmentConversationContext(
  messages: Array<AssistantMessageContext>,
) {
  return messages
    .slice(-12)
    .map((message) => `[${message.id}] ${message.author}: ${compactText(message.body, 260) || 'Attachment message'}`)
    .join('\n')
}

async function buildAttachmentContext(input: {
  attachments: Array<AssistantAttachmentCandidate>
  messages: Array<AssistantMessageContext>
  question: string
}) {
  const notes: Array<string> = []
  const evidence: Array<AssistantEvidence> = []
  const imageParts: Array<{ attachment: AssistantAttachmentCandidate; data: Uint8Array }> = []
  const readerModels = new Set<string>()
  const conversationContext = formatAttachmentConversationContext(input.messages)
  const readerQuestion = attachmentReaderQuestion(input.question)

  for (const attachment of input.attachments) {
    if (attachment.mode !== 'document') continue
    const loaded = await fetchAttachmentBytes(attachment, maxDocumentReaderBytes)
    if (!loaded.ok) {
      const note = `${attachment.filename}: could not read (${loaded.reason}).`
      notes.push(note)
      evidence.push({
        attachmentId: attachment.attachmentId,
        messageId: attachment.messageId,
        quote: note,
        reason: 'Attachment reader could not access the file.',
        ref: String(attachment.messageId),
      })
      continue
    }
    const extracted = extractAttachmentText({
      contentType: attachment.contentType || 'application/octet-stream',
      data: loaded.data,
      filename: attachment.filename,
    })
    if (extracted.ok) {
      const note = formatExtractedAttachmentNote({
        filename: attachment.filename,
        question: readerQuestion,
        text: extracted.text,
      })
      notes.push(note)
      evidence.push({
        attachmentId: attachment.attachmentId,
        messageId: attachment.messageId,
        quote: compactText(note, 220),
        reason: `Locally extracted ${extracted.type} text for ${attachment.filename}.`,
        ref: String(attachment.messageId),
      })
      continue
    }
    try {
      const result = await generateTrackDocumentNotes({
        context: conversationContext,
        data: loaded.data,
        filename: attachment.filename,
        mediaType: attachment.contentType || 'application/octet-stream',
        question: readerQuestion,
      })
      readerModels.add(result.model)
      const note = compactText(result.text, 1200)
      notes.push(note)
      evidence.push({
        attachmentId: attachment.attachmentId,
        messageId: attachment.messageId,
        quote: note.slice(0, 220),
        reason: `Query-specific document reader notes for ${attachment.filename}.`,
        ref: String(attachment.messageId),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'reader failed'
      const note = `${attachment.filename}: could not read (${compactText(reason, 120)}).`
      notes.push(note)
      evidence.push({
        attachmentId: attachment.attachmentId,
        messageId: attachment.messageId,
        quote: note,
        reason: 'Attachment reader failed.',
        ref: String(attachment.messageId),
      })
    }
  }

  for (const attachment of input.attachments) {
    if (attachment.mode !== 'image') continue
    const loaded = await fetchAttachmentBytes(attachment, maxImageBytes)
    if (!loaded.ok) {
      const note = `${attachment.filename}: image could not be read (${loaded.reason}).`
      notes.push(note)
      evidence.push({
        attachmentId: attachment.attachmentId,
        messageId: attachment.messageId,
        quote: note,
        reason: 'Image attachment could not be loaded.',
        ref: String(attachment.messageId),
      })
      continue
    }
    imageParts.push({ attachment, data: loaded.data })
    const note = `${attachment.filename}: image attached directly to the final model from message [${attachment.messageId}].`
    notes.push(note)
    evidence.push({
      attachmentId: attachment.attachmentId,
      messageId: attachment.messageId,
      quote: note,
      reason: 'Image attachment provided directly to Track Assistant.',
      ref: String(attachment.messageId),
    })
  }

  return {
    evidence,
    imageParts,
    notes,
    readerModels: Array.from(readerModels),
  }
}

function buildAnswerPromptInput(prompt: string, imageParts: Array<{ attachment: AssistantAttachmentCandidate; data: Uint8Array }>) {
  if (imageParts.length === 0) return prompt
  const content: ModelMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...imageParts.flatMap(({ attachment, data }) => [
          {
            type: 'text' as const,
            text: `Image attachment ${attachment.filename} from message [${attachment.messageId}] by ${attachment.messageAuthor}. If you rely on this image, cite [${attachment.messageId}].`,
          },
          {
            type: 'image' as const,
            image: data,
            mediaType: attachment.contentType || 'image/png',
          },
        ]),
      ],
    },
  ]
  return content
}

function answerPrompt(input: {
  attachmentNotes: Array<string>
  question: string
  memory: AssistantMemoryContext
  messages: Array<AssistantMessageContext>
  records: Array<AssistantRecordContext>
  drafts: Array<AssistantDraftContext>
}) {
  return [
    'You are Track Assistant, a helpful teammate inside a project group chat.',
    'Sound like a capable fellow team member: casual, direct, warm, and practical.',
    'Do not sound like a support bot, auditor, or legal evidence machine.',
    'Write in plain chat style: lowercase by default, no emoji, no markdown, no bullets, no headings, no line breaks unless the user explicitly asks for structure.',
    'Do not use bold, italics, code formatting, tables, or numbered lists.',
    'Answer the person first. Then, only if useful, mention what should be tracked.',
    'Use only the supplied evidence for factual claims. If evidence is insufficient, say so plainly.',
    'For file/document claims, use only the query-specific attachment notes. The document reader may be incomplete; do not infer beyond its notes.',
    'For image claims, inspect the attached image inputs directly and cite the owning message id.',
    'For casual greetings, acknowledgements, thanks, tests, or tiny messages, respond naturally and say there is nothing project-worthy to track.',
    'Do not turn greetings, repeated @track pings, acknowledgements, or test messages into tasks.',
    'Cite only important factual claims with bracket citations like [messageId]. Avoid citing every sentence.',
    'Never expose raw ids except as bracket citations. The UI will render citations.',
    'If the answer reveals a real decision, task, blocker, or scope-relevant item, end with one short offer to make or update a Draft Record.',
    'Keep most answers to one short paragraph of 1-3 sentences unless the user asks for detail.',
    '',
    `Question: ${cleanQuestion(input.question)}`,
    '',
    'Project Memory:',
    formatProjectMemoryPromptSection(input.memory),
    '',
    'Current Group messages:',
    input.messages.length
      ? input.messages
          .map((message) => `[${message.id}] ${message.author}: ${message.body}`)
          .join('\n')
      : 'No messages available.',
    '',
    'Query-specific attachment notes:',
    input.attachmentNotes.length
      ? input.attachmentNotes.map((note) => `- ${note}`).join('\n')
      : 'No attachment contents were read for this question.',
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

function formatProjectMemoryPromptSection(memory: AssistantMemoryContext) {
  const status = memory.loaded
    ? `loaded fully (${memory.content.length} characters)`
    : `omitted (${memory.reason ?? 'not available'})`
  return [
    `boxId: ${memory.boxId ?? 'none'}`,
    `contextLength: ${memory.content.length}`,
    `lastContextUpdatedAt: ${memory.lastContextUpdatedAt ? new Date(memory.lastContextUpdatedAt).toISOString() : 'unknown'}`,
    `loadStatus: ${status}`,
    memory.loaded
      ? `context.md:\n${memory.content}`
      : 'context.md was not available for this run. Do not claim project memory was loaded.',
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
  handler: async (ctx, args): Promise<{ answer: string; streamId: Id<'assistantStreams'> }> => {
    await ctx.runMutation(internal.assistant.authorizeAsk, {
      groupId: args.groupId,
      requesterId: args.requesterId,
    })
    const context: CollectedAssistantContext = await ctx.runQuery(api.assistant.collectContext, args)
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
      const attachmentContext = await buildAttachmentContext({
        attachments: context.attachments,
        messages: context.messages,
        question: args.question,
      })
      const memoryContext: AssistantMemoryContext = await ctx.runAction((api as any).memoryActions.loadContextForAssistant, {
        actorId: args.requesterId,
        groupId: args.groupId,
        projectId: args.projectId,
      })
      const directAnswer: string | null = context.attachments.length === 0 ? lowSignalAnswer(args.question) : null
      if (directAnswer) {
        await ctx.runMutation(internal.assistant.completeStream, {
          streamId,
          answer: directAnswer,
          evidence: [],
          model: 'track-local-intent',
          durationMs: Date.now() - startedAt,
          retrievalScope: 'low_signal_direct_response',
        })
        return { streamId, answer: directAnswer }
      }
      const result = await generateTrackText(
        buildAnswerPromptInput(
          answerPrompt({
            attachmentNotes: attachmentContext.notes,
            question: args.question,
            memory: memoryContext,
            messages: context.messages,
            records: context.records,
            drafts: context.drafts,
          }),
          attachmentContext.imageParts,
        ),
      )
      const citedIds = extractCitations(result.text)
      const allEvidence = [...attachmentContext.evidence, ...context.evidence]
      const evidence = allEvidence
        .filter((item: { ref: string }) => citedIds.includes(item.ref))
        .slice(0, 8)
        .map((item: AssistantEvidence) => ({
          attachmentId: item.attachmentId,
          messageId: item.messageId,
          quote: item.quote,
          reason: item.reason,
        }))
      const fallbackEvidence = evidence.length
        ? evidence
        : allEvidence.slice(0, 3).map((item: AssistantEvidence) => ({
            attachmentId: item.attachmentId,
            messageId: item.messageId,
            quote: item.quote,
            reason: item.reason,
          }))
      const readerModelLabel = attachmentContext.readerModels.length
        ? `; reader=${attachmentContext.readerModels.join(',')}`
        : ''

      await ctx.runMutation(internal.assistant.completeStream, {
        streamId,
        answer: result.text,
        evidence: fallbackEvidence,
        model: result.model,
        durationMs: Date.now() - startedAt,
        retrievalScope: `project_memory_${memoryContext.loaded ? 'loaded' : 'omitted'}_plus_current_group_accessible_records_and_query_conditioned_attachments${readerModelLabel}`,
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
  handler: async (ctx, args): Promise<CollectedAssistantContext> => {
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
      attachments: selectAttachmentCandidates(attachmentCandidates),
      evidence: [
        ...orderedMessages.map((message, index) => ({
          ref: String(message._id),
          messageId: message._id,
          quote: formattedMessages[index]?.body.slice(0, 220) ?? message.body.slice(0, 220),
          reason: message.forwardedFrom
            ? 'Current Group message containing forwarded/copied evidence.'
            : 'Current Group message.',
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
