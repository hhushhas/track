"use node";

import { v } from 'convex/values'
import type { ModelMessage } from 'ai'

import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction } from './_generated/server'
import { generateTrackDocumentNotes, generateTrackText } from './lib/ai'
import { extractAttachmentText, formatExtractedAttachmentNote } from './lib/attachmentTextExtraction'
import {
  attachmentReaderQuestion,
  compactText,
  formatAttachmentSize,
  maxDocumentReaderBytes,
  maxImageBytes,
} from './lib/assistantAttachments'

const citationPattern = /\[([a-z0-9]+)\]/gi

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
type AssistantMemoryContext = {
  boxId: string | null
  content: string
  lastContextUpdatedAt?: number
  loaded: boolean
  reason?: string
}

type CollectedAssistantContext = {
  attachments: Array<AssistantAttachmentCandidate>
  evidence: Array<AssistantEvidence>
  messages: Array<AssistantMessageContext>
}

function cleanQuestion(question: string) {
  return question.replace(/@track/gi, '').trim() || question.trim()
}

function extractCitations(answer: string) {
  return Array.from(new Set(Array.from(answer.matchAll(citationPattern)).map((match) => match[1])))
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
}) {
  return [
    'You are Track Assistant, a helpful teammate inside a project group chat.',
    'Sound like a capable fellow team member: casual, direct, warm, and practical.',
    'Do not sound like a support bot, auditor, or legal evidence machine.',
    'Write in plain chat style: lowercase by default, no emoji, no markdown, no bullets, no headings, no line breaks unless the user explicitly asks for structure.',
    'Do not use bold, italics, code formatting, tables, or numbered lists.',
    'Answer the person first.',
    'Use only the supplied evidence for factual claims. If evidence is insufficient, say so plainly.',
    'For file/document claims, use only the query-specific attachment notes. The document reader may be incomplete; do not infer beyond its notes.',
    'For image claims, inspect the attached image inputs directly and cite the owning message id.',
    'For casual greetings, acknowledgements, thanks, tests, or tiny messages, respond naturally.',
    'Cite only important factual claims with bracket citations like [messageId]. Avoid citing every sentence.',
    'Never expose raw ids except as bracket citations. The UI will render citations.',
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

export const answerStream = internalAction({
  args: {
    context: v.any(),
    directAnswer: v.union(v.string(), v.null()),
    groupId: v.id('groups'),
    projectId: v.id('projects'),
    question: v.string(),
    requesterId: v.id('users'),
    requesterProjectMemberId: v.optional(v.id('projectMembers')),
    actingCompanyId: v.optional(v.id('companies')),
    streamId: v.id('assistantStreams'),
  },
  handler: async (ctx, args): Promise<{ answer: string; streamId: Id<'assistantStreams'> }> => {
    const startedAt = Date.now()

    try {
      await ctx.runMutation(internal.assistant.updateStreamStatus, {
        streamId: args.streamId,
        status: 'running',
      })

      if (args.directAnswer) {
        await ctx.runMutation(internal.assistant.completeStream, {
          streamId: args.streamId,
          answer: args.directAnswer,
          evidence: [],
          model: 'track-local-intent',
          durationMs: Date.now() - startedAt,
          retrievalScope: 'low_signal_direct_response',
        })
        return { streamId: args.streamId, answer: args.directAnswer }
      }

      const context = args.context as CollectedAssistantContext
      const attachmentContext = await buildAttachmentContext({
        attachments: context.attachments,
        messages: context.messages,
        question: args.question,
      })
      const memoryContext: AssistantMemoryContext = await ctx.runAction((api as any).memoryActions.loadContextForAssistant, {
        actorId: args.requesterId,
        projectMemberId: args.requesterProjectMemberId,
        actingCompanyId: args.actingCompanyId,
        groupId: args.groupId,
        projectId: args.projectId,
      })
      const result = await generateTrackText(
        buildAnswerPromptInput(
          answerPrompt({
            attachmentNotes: attachmentContext.notes,
            question: args.question,
            memory: memoryContext,
            messages: context.messages,
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
        streamId: args.streamId,
        answer: result.text,
        evidence: fallbackEvidence,
        model: result.model,
        durationMs: Date.now() - startedAt,
        retrievalScope: `project_memory_${memoryContext.loaded ? 'loaded' : 'omitted'}_plus_current_group_messages_and_query_conditioned_attachments${readerModelLabel}`,
      })
      return { streamId: args.streamId, answer: result.text }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'assistant_failed'
      await ctx.runMutation(internal.assistant.failStream, {
        streamId: args.streamId,
        error: message,
      })
      return {
        streamId: args.streamId,
        answer: 'Track could not complete that answer. Please try again in a moment.',
      }
    }
  },
})

export const draftModelAnswer = internalAction({
  args: {
    messages: v.array(v.object({ authorId: v.string(), body: v.string() })),
    question: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const transcript = args.messages
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
