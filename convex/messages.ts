import { resolveReleaseFeatureFlag } from '@track/shared/feature-flags'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import { appendAuditEvent } from './lib/audit'
import { rateLimiter } from './lib/rateLimit'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import {
  allocateChannelSequence,
  assertReplyScope,
  followMentionedThreadMembers,
  requireThreadsEnabled,
  resolveActorProjectMember,
  threadsEnabled,
  upsertThreadFollower,
} from './lib/channelThreadPolicy'

const attachmentKind = v.union(v.literal('file'), v.literal('voice_note'))
type MessageDetailCtx = QueryCtx | MutationCtx
type ArchivedMemberSnapshot = {
  membership: {
    _id: Id<'projectMembers'>
    companyId?: Id<'companies'>
    role: Doc<'projectMembers'>['role']
    userId: Id<'users'>
    companyDisplayNameSnapshot?: string
  }
  user: { _id: Id<'users'>; displayName: string }
  company: { _id: Id<'companies'>; displayName: string } | null
}

function archivedMemberForMessage(
  message: Pick<Doc<'messages'>, 'authorId' | 'authorProjectMemberId'>,
  snapshots?: Array<ArchivedMemberSnapshot>,
) {
  return snapshots?.find((snapshot) => message.authorProjectMemberId
    ? snapshot.membership._id === message.authorProjectMemberId
    : snapshot.membership.userId === message.authorId)
}

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

async function markThreadAuthorRead(
  ctx: MutationCtx,
  thread: Doc<'channelThreads'>,
  projectMember: Doc<'projectMembers'>,
  userId: Id<'users'>,
  channelSequence: number,
  actingCompanyId?: Id<'companies'>,
) {
  const existing = await ctx.db
    .query('channelThreadReadStates')
    .withIndex('by_thread_project_member', (q) =>
      q.eq('channelThreadId', thread._id).eq('projectMemberId', projectMember._id),
    )
    .unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, {
      lastReadChannelSequence: Math.max(existing.lastReadChannelSequence, channelSequence),
      updatedAt: now,
    })
    return
  }
  await ctx.db.insert('channelThreadReadStates', {
    projectId: thread.projectId,
    groupId: thread.groupId,
    channelThreadId: thread._id,
    userId,
    projectMemberId: projectMember._id,
    actingCompanyId,
    lastReadChannelSequence: channelSequence,
    createdAt: now,
    updatedAt: now,
  })
}

export async function buildMessageDetail(
  ctx: MessageDetailCtx,
  message: Doc<'messages'>,
  viewerId: Id<'users'>,
  viewerProjectMemberId?: Id<'projectMembers'>,
  cutoff?: number,
  archivedChannelSnapshots?: Array<{ _id: Id<'groups'>; name: string }>,
  archivedThreadSnapshots?: Array<{
    _id: Id<'channelThreads'>
    name: string
    status: 'active' | 'archived'
    replyCount?: number
    latestReplyAt?: number
  }>,
  archivedMemberSnapshots?: Array<ArchivedMemberSnapshot>,
) {
  const archivedAuthor = cutoff
    ? archivedMemberForMessage(message, archivedMemberSnapshots)
    : undefined
  const author = cutoff ? archivedAuthor?.user ?? null : await ctx.db.get(message.authorId)
  const authorProjectMember = cutoff
    ? archivedAuthor?.membership ?? null
    : message.authorProjectMemberId
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
  const archivedReplyAuthor = cutoff && replyToMessage
    ? archivedMemberForMessage(replyToMessage, archivedMemberSnapshots)
    : undefined
  const replyToAuthor = cutoff
    ? archivedReplyAuthor?.user ?? null
    : replyToMessage ? await ctx.db.get(replyToMessage.authorId) : null
  const sourceMembership = message.forwardedFrom && !archivedChannelSnapshots
    ? viewerProjectMemberId
      ? await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) =>
          q.eq('groupId', message.forwardedFrom!.sourceGroupId).eq('projectMemberId', viewerProjectMemberId),
        ).unique()
      : await getGroupMembership(ctx, message.forwardedFrom.sourceGroupId, viewerId)
    : null
  const sourceGroupAccess = message.forwardedFrom
    ? archivedChannelSnapshots
      ? archivedChannelSnapshots.some((channel) => channel._id === message.forwardedFrom!.sourceGroupId)
      : Boolean(sourceMembership && (!sourceMembership.status || sourceMembership.status === 'active'))
    : false
  const sourceGroupSnapshot = message.forwardedFrom
    ? archivedChannelSnapshots?.find((channel) => channel._id === message.forwardedFrom!.sourceGroupId)
    : undefined
  const sourceGroup = message.forwardedFrom && sourceGroupAccess && !archivedChannelSnapshots
    ? await ctx.db.get(message.forwardedFrom.sourceGroupId)
    : null
  const sourceThread = threadsEnabled() && !message.channelThreadId
    ? await ctx.db
        .query('channelThreads')
        .withIndex('by_group_source', (q) =>
          q.eq('groupId', message.groupId).eq('sourceMessageId', message._id),
        )
        .unique()
    : null
  const sourceThreadSnapshot = sourceThread
    ? archivedThreadSnapshots?.find((snapshot) => snapshot._id === sourceThread._id)
    : undefined
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
      replyToMessage &&
      replyToMessage.groupId === message.groupId &&
      replyToMessage.channelThreadId === message.channelThreadId &&
      (!cutoff || replyToMessage.createdAt <= cutoff)
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
          sourceGroupName: sourceGroupSnapshot?.name ?? sourceGroup?.name ?? null,
        }
      : null,
    channelThread: sourceThread && (!cutoff || sourceThreadSnapshot)
      ? {
          threadId: sourceThread._id,
          name: sourceThreadSnapshot?.name ?? sourceThread.name,
          status: sourceThreadSnapshot?.status ?? sourceThread.status,
          replyCount: sourceThreadSnapshot?.replyCount ?? sourceThread.replyCount ?? 0,
          latestReplyAt: sourceThreadSnapshot?.latestReplyAt ?? sourceThread.latestReplyAt ?? null,
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
      .withIndex('by_group_thread_created_at', (q) => cutoff
        ? q.eq('groupId', args.groupId).eq('channelThreadId', undefined).lte('createdAt', cutoff)
        : q.eq('groupId', args.groupId).eq('channelThreadId', undefined))
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
      .withIndex('by_group_thread_created_at', (q) => cutoff
        ? q.eq('groupId', args.groupId).eq('channelThreadId', undefined).lte('createdAt', cutoff)
        : q.eq('groupId', args.groupId).eq('channelThreadId', undefined))
      .order('desc')
      .take(args.limit ?? 50)

    return await Promise.all(messages.map(async (message) =>
      await buildMessageDetail(
        ctx,
        message,
        args.userId,
        args.projectMemberId,
        cutoff,
        access.companyAccess?.entitlement?.channelSnapshots,
        access.companyAccess?.entitlement?.threadSnapshots,
        access.companyAccess?.entitlement?.memberSnapshots,
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
    mentionedProjectMemberIds: v.optional(v.array(v.id('projectMembers'))),
    replyToMessageId: v.optional(v.id('messages')),
    notificationPreview: v.optional(v.string()),
    channelThreadId: v.optional(v.id('channelThreads')),
    idempotencyKey: v.optional(v.string()),
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
    const projectMember = await resolveActorProjectMember(
      ctx,
      args.projectId,
      args.authorId,
      access.companyAccess?.projectMember,
    )
    let channelThread = null
    if (args.channelThreadId) {
      requireThreadsEnabled()
      if (
        (group.status && group.status !== 'active') ||
        (access.project.status && access.project.status !== 'active')
      ) {
        throw new Error('thread_parent_read_only')
      }
      channelThread = await ctx.db.get(args.channelThreadId)
      if (
        !channelThread ||
        channelThread.projectId !== args.projectId ||
        channelThread.groupId !== args.groupId
      ) {
        throw new Error('thread_access_changed')
      }
      if (channelThread.status !== 'active') throw new Error('thread_archived')
    }
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query('messages')
        .withIndex('by_author_idempotency', (q) =>
          q
            .eq('authorProjectMemberId', projectMember._id)
            .eq('idempotencyKey', args.idempotencyKey),
        )
        .unique()
      if (existing) {
        if (
          existing.projectId !== args.projectId ||
          existing.groupId !== args.groupId ||
          existing.channelThreadId !== args.channelThreadId
        ) {
          throw new Error('idempotency_scope_mismatch')
        }
        return existing._id
      }
    }
    await rateLimiter.limit(ctx, 'sendMessage', {
      key: args.authorId,
      throws: true,
    })
    await assertReplyScope(ctx, args.replyToMessageId, args)
    const channelSequence = await allocateChannelSequence(ctx, group)
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.groupId,
      authorId: args.authorId,
      authorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      channelThreadId: args.channelThreadId,
      channelSequence,
      idempotencyKey: args.idempotencyKey,
      body: args.body,
      mentions: args.mentions ?? [],
      mentionedProjectMemberIds: args.mentionedProjectMemberIds,
      attachmentIds: [],
      replyToMessageId: args.replyToMessageId,
      notificationPreview: args.notificationPreview,
      createdAt: Date.now(),
    })

    if (channelThread) {
      const createdAt = Date.now()
      await ctx.db.patch(channelThread._id, {
        replyCount: (channelThread.replyCount ?? 0) + 1,
        latestReplyAt: createdAt,
        latestChannelSequence: channelSequence,
        updatedAt: createdAt,
      })
      await upsertThreadFollower(ctx, {
        thread: channelThread,
        userId: args.authorId,
        projectMember,
        actingCompanyId: access.companyAccess?.company._id,
        reason: 'replied',
      })
      await followMentionedThreadMembers(
        ctx,
        channelThread,
        args.mentions ?? [],
        args.mentionedProjectMemberIds,
      )
      await markThreadAuthorRead(ctx, channelThread, projectMember, args.authorId, channelSequence, access.companyAccess?.company._id)
    }

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.authorId,
      actorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      channelThreadId: args.channelThreadId,
      entityType: 'message',
      entityId: messageId,
      action: 'message.sent',
      after: {
        bodyPreview: args.body.slice(0, 180),
        mentionCount: args.mentions?.length ?? 0,
        replyToMessageId: args.replyToMessageId,
        channelSequence,
        channelThreadId: args.channelThreadId,
      },
    })

    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverMessageNotifications, {
      messageId,
    })
    if (resolveReleaseFeatureFlag(process.env.TRACK_TASKS_ENABLED)) {
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
    targetChannelThreadId: v.optional(v.id('channelThreads')),
    actorId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    audienceExpansionConfirmed: v.optional(v.boolean()),
    body: v.optional(v.string()),
    mentions: v.optional(v.array(v.id('users'))),
    mentionedProjectMemberIds: v.optional(v.array(v.id('projectMembers'))),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sourceMessage = await ctx.db.get(args.sourceMessageId)
    if (!sourceMessage || sourceMessage.projectId !== args.projectId) {
      throw new Error('source_message_not_found')
    }
    if (sourceMessage.channelThreadId) requireThreadsEnabled()
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
    const projectMember = await resolveActorProjectMember(
      ctx,
      args.projectId,
      args.actorId,
      access.companyAccess?.projectMember,
    )
    let targetThread = null
    if (args.targetChannelThreadId) {
      requireThreadsEnabled()
      if (
        (targetGroup.status && targetGroup.status !== 'active') ||
        (access.project.status && access.project.status !== 'active')
      ) {
        throw new Error('thread_parent_read_only')
      }
      targetThread = await ctx.db.get(args.targetChannelThreadId)
      if (!targetThread || targetThread.groupId !== args.targetGroupId || targetThread.projectId !== args.projectId) {
        throw new Error('thread_access_changed')
      }
      if (targetThread.status !== 'active') throw new Error('thread_archived')
    }
    if (
      sourceMessage.groupId === args.targetGroupId &&
      sourceMessage.channelThreadId === args.targetChannelThreadId
    ) {
      throw new Error('forward_target_same_group')
    }
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query('messages')
        .withIndex('by_author_idempotency', (q) =>
          q
            .eq('authorProjectMemberId', projectMember._id)
            .eq('idempotencyKey', args.idempotencyKey),
        )
        .unique()
      if (existing) return existing._id
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
      const sourceMemberIds = new Set(sourceMembers.flatMap((member) =>
        member?.status === 'active' ? [String(member._id)] : [],
      ))
      const expandsAudience = targetMembers.some((member) =>
        member?.status === 'active' && !sourceMemberIds.has(String(member._id)),
      )
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
    const channelSequence = await allocateChannelSequence(ctx, targetGroup)
    const messageId = await ctx.db.insert('messages', {
      projectId: args.projectId,
      groupId: args.targetGroupId,
      authorId: args.actorId,
      authorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      channelThreadId: args.targetChannelThreadId,
      channelSequence,
      idempotencyKey: args.idempotencyKey,
      body,
      mentions: args.mentions ?? [],
      mentionedProjectMemberIds: args.mentionedProjectMemberIds,
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
    if (targetThread) {
      const createdAt = Date.now()
      await ctx.db.patch(targetThread._id, {
        replyCount: (targetThread.replyCount ?? 0) + 1,
        latestReplyAt: createdAt,
        latestChannelSequence: channelSequence,
        updatedAt: createdAt,
      })
      await upsertThreadFollower(ctx, {
        thread: targetThread,
        userId: args.actorId,
        projectMember,
        actingCompanyId: access.companyAccess?.company._id,
        reason: 'replied',
      })
      await followMentionedThreadMembers(
        ctx,
        targetThread,
        args.mentions ?? [],
        args.mentionedProjectMemberIds,
      )
      await markThreadAuthorRead(ctx, targetThread, projectMember, args.actorId, channelSequence, access.companyAccess?.company._id)
    }

    const copiedAttachmentIds = await Promise.all(
      attachmentsToCopy.map(async (attachment) =>
        await ctx.db.insert('attachments', {
          projectId: args.projectId,
          groupId: args.targetGroupId,
          messageId,
          channelThreadId: args.targetChannelThreadId,
          storageId: attachment.storageId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          kind: attachment.kind,
          durationMs: attachment.durationMs,
          uploadedBy: args.actorId,
          uploadedByProjectMemberId: projectMember._id,
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
      actorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      channelThreadId: args.targetChannelThreadId,
      entityType: 'message',
      entityId: messageId,
      action: 'message.forwarded',
      after: {
        sourceGroupId: sourceMessage.groupId,
        sourceMessageId: sourceMessage._id,
        copiedAttachmentCount: copiedAttachmentIds.length,
        bodyPreview: body.slice(0, 180),
        channelSequence,
        channelThreadId: args.targetChannelThreadId,
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
    channelThreadId: v.optional(v.id('channelThreads')),
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
    }, 'writeChannel')
    if (args.channelThreadId) {
      requireThreadsEnabled()
      if (
        (group.status && group.status !== 'active') ||
        (access.project.status && access.project.status !== 'active')
      ) {
        throw new Error('thread_parent_read_only')
      }
      const thread = await ctx.db.get(args.channelThreadId)
      if (!thread || thread.groupId !== group._id || thread.status !== 'active') {
        throw new Error(thread?.status === 'archived' ? 'thread_archived' : 'thread_access_changed')
      }
    }
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
    const projectMember = await resolveActorProjectMember(
      ctx,
      args.projectId,
      args.userId,
      access.companyAccess?.projectMember,
    )
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
    if (message.channelThreadId) {
      requireThreadsEnabled()
      if (
        (group.status && group.status !== 'active') ||
        (access.project.status && access.project.status !== 'active')
      ) {
        throw new Error('thread_parent_read_only')
      }
      const thread = await ctx.db.get(message.channelThreadId)
      if (!thread || thread.status !== 'active') {
        throw new Error(thread?.status === 'archived' ? 'thread_archived' : 'thread_access_changed')
      }
    }
    const attachmentId = await ctx.db.insert('attachments', {
      projectId: args.projectId,
      groupId: args.groupId,
      messageId: args.messageId,
      channelThreadId: message.channelThreadId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      kind: args.kind,
      durationMs: args.durationMs,
      uploadedBy: args.userId,
      uploadedByProjectMemberId: projectMember._id,
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
      actorProjectMemberId: projectMember._id,
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
