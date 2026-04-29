import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import { appendAuditEvent } from './lib/audit'
import { rateLimiter } from './lib/rateLimit'
import { requireGroupMember } from './lib/permissions'

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
) {
  const author = await ctx.db.get(message.authorId)
  const authorProjectMember = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', message.projectId).eq('userId', message.authorId),
    )
    .unique()
  const attachments = await Promise.all(
    message.attachmentIds.map(async (attachmentId) => {
      const attachment = await ctx.db.get(attachmentId)
      if (!attachment) return null
      const url = await ctx.storage.getUrl(attachment.storageId)
      return { attachment, url }
    }),
  )
  const replyToMessage = message.replyToMessageId ? await ctx.db.get(message.replyToMessageId) : null
  const replyToAuthor = replyToMessage ? await ctx.db.get(replyToMessage.authorId) : null
  const sourceGroupAccess = message.forwardedFrom
    ? await getGroupMembership(ctx, message.forwardedFrom.sourceGroupId, viewerId)
    : null
  const sourceGroup = message.forwardedFrom && sourceGroupAccess
    ? await ctx.db.get(message.forwardedFrom.sourceGroupId)
    : null
  return {
    message: message.forwardedFrom ? { ...message, forwardedFrom: undefined } : message,
    author,
    authorRole: authorProjectMember?.role ?? null,
    attachments: attachments.filter((attachment) => attachment !== null),
    replyTo:
      replyToMessage && replyToMessage.groupId === message.groupId
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
          canOpenSource: sourceGroupAccess !== null,
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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

export const listDetailed = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(args.limit ?? 50)

    return await Promise.all(messages.map(async (message) => await buildMessageDetail(ctx, message, args.userId)))
  },
})

export const send = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    authorId: v.id('users'),
    body: v.string(),
    mentions: v.optional(v.array(v.id('users'))),
    replyToMessageId: v.optional(v.id('messages')),
    notificationPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.authorId)
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
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.groupId,
      authorId: args.authorId,
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

    return messageId
  },
})

export const forwardMessage = mutation({
  args: {
    projectId: v.id('projects'),
    sourceMessageId: v.id('messages'),
    targetGroupId: v.id('groups'),
    actorId: v.id('users'),
    body: v.optional(v.string()),
    mentions: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    const sourceMessage = await ctx.db.get(args.sourceMessageId)
    if (!sourceMessage || sourceMessage.projectId !== args.projectId) {
      throw new Error('source_message_not_found')
    }
    await requireGroupMember(ctx, sourceMessage.groupId, args.actorId)
    await requireGroupMember(ctx, args.targetGroupId, args.actorId)
    const targetGroup = await ctx.db.get(args.targetGroupId)
    if (!targetGroup || targetGroup.projectId !== args.projectId) {
      throw new Error('target_group_mismatch')
    }
    if (sourceMessage.groupId === args.targetGroupId) {
      throw new Error('forward_target_same_group')
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
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.storage.generateUploadUrl()
  },
})

export const attachFile = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    messageId: v.id('messages'),
    userId: v.id('users'),
    storageId: v.id('_storage'),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    kind: v.optional(attachmentKind),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
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
