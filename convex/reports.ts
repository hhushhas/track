import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember, requireProjectMember } from './lib/permissions'

const targetType = v.union(
  v.literal('message'),
  v.literal('attachment'),
  v.literal('voice_note'),
  v.literal('assistant_answer'),
)

const reason = v.union(
  v.literal('inaccurate'),
  v.literal('unsafe'),
  v.literal('spam'),
  v.literal('harassment'),
  v.literal('privacy'),
  v.literal('other'),
)

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    reporterId: v.id('users'),
    targetType,
    groupId: v.optional(v.id('groups')),
    targetMessageId: v.optional(v.id('messages')),
    targetAttachmentId: v.optional(v.id('attachments')),
    targetAssistantStreamId: v.optional(v.id('assistantStreams')),
    reason,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.reporterId)
    if (args.groupId) await requireGroupMember(ctx, args.groupId, args.reporterId)

    if (args.targetMessageId) {
      const message = await ctx.db.get(args.targetMessageId)
      if (!message || message.projectId !== args.projectId) throw new Error('message_not_found')
      await requireGroupMember(ctx, message.groupId, args.reporterId)
    }
    if (args.targetAttachmentId) {
      const attachment = await ctx.db.get(args.targetAttachmentId)
      if (!attachment || attachment.projectId !== args.projectId) throw new Error('attachment_not_found')
      await requireGroupMember(ctx, attachment.groupId, args.reporterId)
    }
    if (args.targetAssistantStreamId) {
      const stream = await ctx.db.get(args.targetAssistantStreamId)
      if (!stream || stream.projectId !== args.projectId) throw new Error('assistant_answer_not_found')
      await requireGroupMember(ctx, stream.groupId, args.reporterId)
    }

    const now = Date.now()
    const note = args.note?.trim()
    const reportId = await ctx.db.insert('contentReports', {
      projectId: args.projectId,
      groupId: args.groupId,
      reporterId: args.reporterId,
      targetType: args.targetType,
      targetMessageId: args.targetMessageId,
      targetAttachmentId: args.targetAttachmentId,
      targetAssistantStreamId: args.targetAssistantStreamId,
      reason: args.reason,
      note: note || undefined,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.reporterId,
      entityType: 'contentReport',
      entityId: reportId,
      action: 'content_report.created',
      after: {
        reason: args.reason,
        targetType: args.targetType,
      },
    })

    return reportId
  },
})
