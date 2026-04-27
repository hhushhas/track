import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember } from './lib/permissions'

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

export const send = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    authorId: v.id('users'),
    body: v.string(),
    mentions: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.authorId)
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.groupId,
      authorId: args.authorId,
      body: args.body,
      mentions: args.mentions ?? [],
      attachmentIds: [],
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
      },
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
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    const attachmentId = await ctx.db.insert('attachments', {
      projectId: args.projectId,
      groupId: args.groupId,
      messageId: args.messageId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      uploadedBy: args.userId,
      extractionStatus: 'preserved',
      createdAt: Date.now(),
    })
    const message = await ctx.db.get(args.messageId)
    if (message) {
      await ctx.db.patch(args.messageId, {
        attachmentIds: [...message.attachmentIds, attachmentId],
      })
    }
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
      },
    })
    return attachmentId
  },
})
