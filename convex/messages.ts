import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import { appendAuditEvent } from './lib/audit'
import { rateLimiter } from './lib/rateLimit'
import { authorizeScopedRequest } from './lib/requestAuthorization'

const attachmentKind = v.union(v.literal('file'), v.literal('voice_note'))
type MessageDetailCtx = QueryCtx | MutationCtx

async function getGroupMembership(
  ctx: MessageDetailCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('groupMembers')
    .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', userId))
    .unique()
}

async function buildMessageDetail(
  ctx: MessageDetailCtx,
  message: Doc<'messages'>,
  viewerId: Id<'users'>,
  viewerProjectMemberId?: Id<'projectMembers'>,
  cutoff?: number,
  archivedChannelIds?: Array<Id<'groups'>>,
) {
  const author = await ctx.db.get(message.authorId)
  const authorProjectMember = message.authorProjectMemberId
    ? await ctx.db.get(message.authorProjectMemberId)
    : await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', message.projectId).eq('userId', message.authorId),
      ).first()
  const attachments = await Promise.all(
    message.attachmentIds.map(async (attachmentId) => {
      const attachment = await ctx.db.get(attachmentId)
      if (!attachment || (cutoff && attachment.createdAt > cutoff)) return null
      const url = await ctx.storage.getUrl(attachment.storageId)
      return { attachment, url }
    }),
  )
  const replyToMessage = message.replyToMessageId ? await ctx.db.get(message.replyToMessageId) : null
  const replyToAuthor = replyToMessage ? await ctx.db.get(replyToMessage.authorId) : null
  const sourceMembership = message.forwardedFrom && !archivedChannelIds
    ? viewerProjectMemberId
      ? await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) =>
          q.eq('groupId', message.forwardedFrom!.sourceGroupId).eq('projectMemberId', viewerProjectMemberId),
        ).unique()
      : await getGroupMembership(ctx, message.forwardedFrom.sourceGroupId, viewerId)
    : null
  const sourceGroupAccess = message.forwardedFrom
    ? archivedChannelIds
      ? archivedChannelIds.includes(message.forwardedFrom.sourceGroupId)
      : Boolean(sourceMembership && (!sourceMembership.status || sourceMembership.status === 'active'))
    : false
  const sourceGroup = message.forwardedFrom && sourceGroupAccess
    ? await ctx.db.get(message.forwardedFrom.sourceGroupId)
    : null
  return {
    message: message.forwardedFrom ? { ...message, forwardedFrom: undefined } : message,
    author,
    authorRole: authorProjectMember?.role ?? null,
    authorCompany: authorProjectMember?.companyId
      ? {
          companyId: authorProjectMember.companyId,
          displayName: authorProjectMember.companyDisplayNameSnapshot ?? 'Company',
        }
      : null,
    attachments: attachments.filter((attachment) => attachment !== null),
    replyTo:
      replyToMessage && replyToMessage.groupId === message.groupId && (!cutoff || replyToMessage.createdAt <= cutoff)
        ? {
            messageId: replyToMessage._id,
            authorName: replyToAuthor?.displayName ?? 'Unknown Member',
            body: replyToMessage.body,
            createdAt: replyToMessage.createdAt,
          }
        : null,
    forwardedFrom: message.forwardedFrom
      ? {
          originalAuthorName: message.forwardedFrom.originalAuthorName,
          originalBody: message.forwardedFrom.originalBody,
          originalCreatedAt: message.forwardedFrom.originalCreatedAt,
          attachmentSnapshots: message.forwardedFrom.attachmentSnapshots,
          forwardedAt: message.forwardedFrom.forwardedAt,
          canOpenSource: sourceGroupAccess,
          sourceGroupId: sourceGroupAccess ? message.forwardedFrom.sourceGroupId : null,
          sourceMessageId: sourceGroupAccess ? message.forwardedFrom.sourceMessageId : null,
          sourceGroupName: sourceGroup?.name ?? null,
        }
      : null,
  }
}

export const list = query({
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
      .query('messages')
      .withIndex('by_group_created_at', (q) => cutoff
        ? q.eq('groupId', args.groupId).lte('createdAt', cutoff)
        : q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

export const listDetailed = query({
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
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => cutoff
        ? q.eq('groupId', args.groupId).lte('createdAt', cutoff)
        : q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 50)

    return await Promise.all(messages.map(async (message) =>
      await buildMessageDetail(
        ctx,
        message,
        args.userId,
        args.projectMemberId,
        cutoff,
        access.companyAccess?.entitlement?.channelIds,
      ),
    ))
  },
})

export const send = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    authorId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    body: v.string(),
    mentions: v.optional(v.array(v.id('users'))),
    replyToMessageId: v.optional(v.id('messages')),
    notificationPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.authorId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'writeChannel')
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) {
      throw new Error('group_project_mismatch')
    }
    await rateLimiter.limit(ctx, 'sendMessage', {
      key: args.authorId,
      throws: true,
    })
    if (args.replyToMessageId) {
      const replyToMessage = await ctx.db.get(args.replyToMessageId)
      if (
        !replyToMessage ||
        replyToMessage.projectId !== args.projectId ||
        replyToMessage.groupId !== args.groupId
      ) {
        throw new Error('reply_scope_mismatch')
      }
    }
    const latestChannelMessage = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .first()
    const channelSequence = (latestChannelMessage?.channelSequence ?? 0) + 1
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.groupId,
      authorId: args.authorId,
      authorProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      channelSequence,
      body: args.body,
      mentions: args.mentions ?? [],
      attachmentIds: [],
      replyToMessageId: args.replyToMessageId,
      notificationPreview: args.notificationPreview,
      createdAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.authorId,
      actorProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      entityType: 'message',
      entityId: messageId,
      action: 'message.sent',
      after: {
        bodyPreview: args.body.slice(0, 180),
        mentionCount: args.mentions?.length ?? 0,
        replyToMessageId: args.replyToMessageId,
      },
    })

    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverMessageNotifications, {
      messageId,
    })
    if (process.env.TRACK_TASKS_ENABLED === 'true') {
      await ctx.scheduler.runAfter(0, (internal as any).taskDetection.queueForMessage, { messageId })
    }

    return messageId
  },
})

export const forwardMessage = mutation({
  args: {
    projectId: v.id('projects'),
    sourceMessageId: v.id('messages'),
    targetGroupId: v.id('groups'),
    actorId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    audienceExpansionConfirmed: v.optional(v.boolean()),
    body: v.optional(v.string()),
    mentions: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    const sourceMessage = await ctx.db.get(args.sourceMessageId)
    if (!sourceMessage || sourceMessage.projectId !== args.projectId) {
      throw new Error('source_message_not_found')
    }
    await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: sourceMessage.groupId,
      claimedUserId: args.actorId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.targetGroupId,
      claimedUserId: args.actorId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'writeChannel')
    const targetGroup = await ctx.db.get(args.targetGroupId)
    if (!targetGroup || targetGroup.projectId !== args.projectId) {
      throw new Error('target_group_mismatch')
    }
    if (sourceMessage.groupId === args.targetGroupId) {
      throw new Error('forward_target_same_group')
    }
    if (access.companyAccess) {
      const [sourceMemberships, targetMemberships] = await Promise.all([
        ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', sourceMessage.groupId)).collect(),
        ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', args.targetGroupId)).collect(),
      ])
      const [sourceMembers, targetMembers] = await Promise.all([
        Promise.all(sourceMemberships.filter((item) => item.status === 'active' && item.projectMemberId).map(async (item) => await ctx.db.get(item.projectMemberId!))),
        Promise.all(targetMemberships.filter((item) => item.status === 'active' && item.projectMemberId).map(async (item) => await ctx.db.get(item.projectMemberId!))),
      ])
      const sourceCompanyIds = new Set(sourceMembers.flatMap((member) => member?.companyId ? [String(member.companyId)] : []))
      const expandsAudience = targetMembers.some((member) => member?.companyId && !sourceCompanyIds.has(String(member.companyId)))
      if (expandsAudience && !args.audienceExpansionConfirmed) throw new Error('audience_expansion_confirmation_required')
    }
    await rateLimiter.limit(ctx, 'sendMessage', {
      key: args.actorId,
      throws: true,
    })

    const [originalAuthor, sourceAttachments] = await Promise.all([
      ctx.db.get(sourceMessage.authorId),
      Promise.all(
        sourceMessage.attachmentIds.map(async (attachmentId) => {
          const attachment = await ctx.db.get(attachmentId)
          return attachment
        }),
      ),
    ])
    const attachmentsToCopy = sourceAttachments.filter((attachment) => attachment !== null)
    const body = args.body?.trim() ?? ''
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.targetGroupId,
      authorId: args.actorId,
      authorProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      body,
      mentions: args.mentions ?? [],
      attachmentIds: [],
      forwardedFrom: {
        sourceProjectId: sourceMessage.projectId,
        sourceGroupId: sourceMessage.groupId,
        sourceMessageId: sourceMessage._id,
        originalAuthorId: sourceMessage.authorId,
        originalAuthorName: originalAuthor?.displayName ?? 'Unknown Member',
        originalBody: sourceMessage.body,
        originalCreatedAt: sourceMessage.createdAt,
        attachmentSnapshots: attachmentsToCopy.map((attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          kind: attachment.kind,
          durationMs: attachment.durationMs,
        })),
        forwardedAt: Date.now(),
      },
      notificationPreview: body || 'Forwarded a message.',
      createdAt: Date.now(),
    })

    const copiedAttachmentIds = await Promise.all(
      attachmentsToCopy.map(async (attachment) =>
        await ctx.db.insert('attachments', {
          projectId: args.projectId,
          groupId: args.targetGroupId,
          messageId,
          storageId: attachment.storageId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          kind: attachment.kind,
          durationMs: attachment.durationMs,
          uploadedBy: args.actorId,
          uploadedByProjectMemberId: access.companyAccess?.projectMember._id,
          actingCompanyId: access.companyAccess?.company._id,
          extractionStatus: attachment.extractionStatus,
          createdAt: Date.now(),
        }),
      ),
    )
    if (copiedAttachmentIds.length > 0) {
      await ctx.db.patch(messageId, {
        attachmentIds: copiedAttachmentIds,
      })
    }

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.targetGroupId,
      actorId: args.actorId,
      actorProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      entityType: 'message',
      entityId: messageId,
      action: 'message.forwarded',
      after: {
        sourceGroupId: sourceMessage.groupId,
        sourceMessageId: sourceMessage._id,
        copiedAttachmentCount: copiedAttachmentIds.length,
        bodyPreview: body.slice(0, 180),
      },
    })

    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverMessageNotifications, {
      messageId,
    })

    return messageId
  },
})

export const generateUploadUrl = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
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
    }, 'writeChannel')
    return await ctx.storage.generateUploadUrl()
  },
})

export const attachFile = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    messageId: v.id('messages'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    storageId: v.id('_storage'),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    kind: v.optional(attachmentKind),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'writeChannel')
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) {
      throw new Error('group_project_mismatch')
    }
    const message = await ctx.db.get(args.messageId)
    if (
      !message ||
      message.projectId !== args.projectId ||
      message.groupId !== args.groupId
    ) {
      throw new Error('message_scope_mismatch')
    }
    const attachmentId = await ctx.db.insert('attachments', {
      projectId: args.projectId,
      groupId: args.groupId,
      messageId: args.messageId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      kind: args.kind,
      durationMs: args.durationMs,
      uploadedBy: args.userId,
      uploadedByProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      extractionStatus: 'preserved',
      createdAt: Date.now(),
    })
    await ctx.db.patch(args.messageId, {
      attachmentIds: [...message.attachmentIds, attachmentId],
    })
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.userId,
      actorProjectMemberId: access.companyAccess?.projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      entityType: 'attachment',
      entityId: attachmentId,
      action: 'attachment.preserved',
      after: {
        filename: args.filename,
        contentType: args.contentType,
        size: args.size,
        kind: args.kind ?? 'file',
        durationMs: args.durationMs,
      },
    })
    return attachmentId
  },
})
