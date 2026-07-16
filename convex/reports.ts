import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { authorizeScopedRequest } from './lib/requestAuthorization'

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
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    targetType,
    groupId: v.optional(v.id('groups')),
    targetMessageId: v.optional(v.id('messages')),
    targetAttachmentId: v.optional(v.id('attachments')),
    targetAssistantStreamId: v.optional(v.id('assistantStreams')),
    reason,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const baseAccess = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.reporterId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, args.groupId ? 'readChannel' : 'readProject')

    if (args.targetMessageId) {
      const message = await ctx.db.get(args.targetMessageId)
      if (!message || message.projectId !== args.projectId) throw new Error('message_not_found')
      await authorizeScopedRequest(ctx, { projectId: args.projectId, groupId: message.groupId, claimedUserId: args.reporterId, actingCompanyId: args.actingCompanyId, projectMemberId: args.projectMemberId }, 'readChannel')
    }
    if (args.targetAttachmentId) {
      const attachment = await ctx.db.get(args.targetAttachmentId)
      if (!attachment || attachment.projectId !== args.projectId) throw new Error('attachment_not_found')
      await authorizeScopedRequest(ctx, { projectId: args.projectId, groupId: attachment.groupId, claimedUserId: args.reporterId, actingCompanyId: args.actingCompanyId, projectMemberId: args.projectMemberId }, 'readChannel')
    }
    if (args.targetAssistantStreamId) {
      const stream = await ctx.db.get(args.targetAssistantStreamId)
      if (!stream || stream.projectId !== args.projectId) throw new Error('assistant_answer_not_found')
      await authorizeScopedRequest(ctx, { projectId: args.projectId, groupId: stream.groupId, claimedUserId: args.reporterId, actingCompanyId: args.actingCompanyId, projectMemberId: args.projectMemberId }, 'readChannel')
    }

    const now = Date.now()
    const note = args.note?.trim()
    const reportId = await ctx.db.insert('contentReports', {
      projectId: args.projectId,
      groupId: args.groupId,
      reporterId: args.reporterId,
      reporterProjectMemberId: baseAccess.companyAccess?.projectMember._id,
      actingCompanyId: baseAccess.companyAccess?.company._id,
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
      actorProjectMemberId: baseAccess.companyAccess?.projectMember._id,
      actingCompanyId: baseAccess.companyAccess?.company._id,
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
