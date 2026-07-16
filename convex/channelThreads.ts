import { validateChannelThreadName } from '@track/shared/threads'
import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import {
  requireThreadsEnabled,
  resolveActorProjectMember,
  threadsEnabled,
  upsertThreadFollower,
} from './lib/channelThreadPolicy'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { buildMessageDetail } from './messages'

const threadStatus = v.union(v.literal('active'), v.literal('archived'))
type ThreadCtx = QueryCtx | MutationCtx
type ThreadSnapshot = {
  _id: Id<'channelThreads'>
  name: string
  status: 'active' | 'archived'
  revision: number
  sourceAvailable: boolean
  following: boolean
  lastReadChannelSequence: number
}

async function authorizeThread(
  ctx: ThreadCtx,
  input: {
    threadId: Id<'channelThreads'>
    userId: Id<'users'>
    actingCompanyId?: Id<'companies'>
    projectMemberId?: Id<'projectMembers'>
  },
  capability: 'readChannel' | 'writeChannel' = 'readChannel',
) {
  const thread = await ctx.db.get(input.threadId)
  if (!thread) throw new Error('thread_unavailable')
  const access = await authorizeScopedRequest(ctx, {
    projectId: thread.projectId,
    groupId: thread.groupId,
    claimedUserId: input.userId,
    actingCompanyId: input.actingCompanyId,
    projectMemberId: input.projectMemberId,
  }, capability)
  if (capability === 'writeChannel') {
    const group = await ctx.db.get(thread.groupId)
    if (
      !group ||
      (group.status && group.status !== 'active') ||
      (access.project.status && access.project.status !== 'active')
    ) {
      throw new Error('thread_parent_read_only')
    }
  }
  const projectMember = await resolveActorProjectMember(
    ctx,
    thread.projectId,
    input.userId,
    access.companyAccess?.projectMember,
  )
  const cutoff = access.companyAccess?.entitlement?.exitAt
  if (cutoff && thread.createdAt > cutoff) throw new Error('thread_unavailable')
  return { access, cutoff, projectMember, thread }
}

async function canManageThread(
  ctx: ThreadCtx,
  thread: Doc<'channelThreads'>,
  projectMember: Doc<'projectMembers'>,
) {
  if (thread.creatorProjectMemberId === projectMember._id) return true
  const manager = projectMember.role === 'owner' ||
    projectMember.role === 'admin' ||
    projectMember.role === 'manager'
  if (!manager) return false
  if (!projectMember.companyId) return true
  const membership = await ctx.db
    .query('groupMembers')
    .withIndex('by_group_project_member', (q) =>
      q.eq('groupId', thread.groupId).eq('projectMemberId', projectMember._id),
    )
    .unique()
  return membership?.status === 'active' && membership.isSteward === true
}

async function buildThreadSummary(
  ctx: ThreadCtx,
  thread: Doc<'channelThreads'>,
  projectMember: Doc<'projectMembers'>,
  cutoff?: number,
  snapshot?: ThreadSnapshot,
) {
  const [messages, follower, readState, sourceMessage] = await Promise.all([
    ctx.db
      .query('messages')
      .withIndex('by_thread_created_at', (q) => cutoff
        ? q.eq('channelThreadId', thread._id).lte('createdAt', cutoff)
        : q.eq('channelThreadId', thread._id))
      .collect(),
    ctx.db
      .query('channelThreadFollowers')
      .withIndex('by_thread_project_member', (q) =>
        q.eq('channelThreadId', thread._id).eq('projectMemberId', projectMember._id),
      )
      .unique(),
    ctx.db
      .query('channelThreadReadStates')
      .withIndex('by_thread_project_member', (q) =>
        q.eq('channelThreadId', thread._id).eq('projectMemberId', projectMember._id),
      )
      .unique(),
    thread.sourceMessageId ? ctx.db.get(thread.sourceMessageId) : null,
  ])
  const latestMessage = messages.reduce<Doc<'messages'> | null>(
    (latest, message) => !latest || message.createdAt > latest.createdAt ? message : latest,
    null,
  )
  const following = snapshot?.following ?? follower?.preference === 'following'
  const unread = following && messages.some((message) =>
    message.authorProjectMemberId !== projectMember._id &&
    (message.channelSequence ?? 0) >
      (snapshot?.lastReadChannelSequence ?? readState?.lastReadChannelSequence ?? 0),
  )
  const sourceAvailable = snapshot?.sourceAvailable ?? Boolean(
    sourceMessage &&
    sourceMessage.projectId === thread.projectId &&
    sourceMessage.groupId === thread.groupId &&
    !sourceMessage.channelThreadId &&
    (!cutoff || sourceMessage.createdAt <= cutoff),
  )

  return {
    thread: snapshot
      ? { ...thread, name: snapshot.name, revision: snapshot.revision, status: snapshot.status }
      : thread,
    canManage: cutoff ? false : await canManageThread(ctx, thread, projectMember),
    following,
    unread,
    replyCount: messages.length,
    latestReplyAt: latestMessage?.createdAt ?? null,
    source: sourceAvailable && sourceMessage
      ? {
          messageId: sourceMessage._id,
          body: sourceMessage.body,
          createdAt: sourceMessage.createdAt,
        }
      : thread.sourceMessageId
        ? { unavailable: true as const }
        : null,
  }
}

export const list = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    status: v.optional(threadStatus),
  },
  handler: async (ctx, args) => {
    if (!threadsEnabled()) return []
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('channel_unavailable')
    const access = await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    const projectMember = await resolveActorProjectMember(
      ctx,
      group.projectId,
      args.userId,
      access.companyAccess?.projectMember,
    )
    const cutoff = access.companyAccess?.entitlement?.exitAt
    const status = args.status ?? 'active'
    const snapshots = new Map<string, ThreadSnapshot>(
      ((access.companyAccess?.entitlement?.threadSnapshots ?? []) as Array<ThreadSnapshot>)
        .map((snapshot) => [String(snapshot._id), snapshot]),
    )
    const threads = cutoff
      ? [
          ...(await ctx.db
            .query('channelThreads')
            .withIndex('by_group_status_updated_at', (q) =>
              q.eq('groupId', group._id).eq('status', 'active'),
            )
            .collect()),
          ...(await ctx.db
            .query('channelThreads')
            .withIndex('by_group_status_updated_at', (q) =>
              q.eq('groupId', group._id).eq('status', 'archived'),
            )
            .collect()),
        ]
      : await ctx.db
          .query('channelThreads')
          .withIndex('by_group_status_updated_at', (q) =>
            q.eq('groupId', group._id).eq('status', status),
          )
          .order('desc')
          .collect()
    return await Promise.all(
      threads
        .filter((thread) => {
          if (!cutoff) return true
          const snapshot = snapshots.get(String(thread._id))
          return Boolean(snapshot && snapshot.status === status)
        })
        .map((thread) => buildThreadSummary(
          ctx,
          thread,
          projectMember,
          cutoff,
          snapshots.get(String(thread._id)),
        )),
    )
  },
})

export const get = query({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    if (!threadsEnabled()) return null
    try {
      const { access, cutoff, projectMember, thread } = await authorizeThread(ctx, args)
      const snapshot = (access.companyAccess?.entitlement?.threadSnapshots ?? [])
        .find((item: { _id?: Id<'channelThreads'> }) => item._id === thread._id) as ThreadSnapshot | undefined
      if (cutoff && !snapshot) return null
      return await buildThreadSummary(ctx, thread, projectMember, cutoff, snapshot)
    } catch {
      return null
    }
  },
})

export const listMessages = query({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!threadsEnabled()) return []
    const { access, cutoff, thread } = await authorizeThread(ctx, args)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_thread_created_at', (q) => cutoff
        ? q.eq('channelThreadId', thread._id).lte('createdAt', cutoff)
        : q.eq('channelThreadId', thread._id))
      .order('desc')
      .take(args.limit ?? 80)
    return await Promise.all(messages.map(async (message) =>
      await buildMessageDetail(
        ctx,
        message,
        args.userId,
        args.projectMemberId,
        cutoff,
        access.companyAccess?.entitlement?.channelIds,
        access.companyAccess?.entitlement?.threadSnapshots,
      ),
    ))
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    creatorId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    name: v.string(),
    sourceMessageId: v.optional(v.id('messages')),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireThreadsEnabled()
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.creatorId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'writeChannel')
    const [group, projectMember] = await Promise.all([
      ctx.db.get(args.groupId),
      resolveActorProjectMember(
        ctx,
        args.projectId,
        args.creatorId,
        access.companyAccess?.projectMember,
      ),
    ])
    if (!group || group.projectId !== args.projectId) throw new Error('thread_access_changed')
    if (
      (group.status && group.status !== 'active') ||
      (access.project.status && access.project.status !== 'active')
    ) {
      throw new Error('thread_parent_read_only')
    }
    const existing = await ctx.db
      .query('channelThreads')
      .withIndex('by_creator_idempotency', (q) =>
        q
          .eq('creatorProjectMemberId', projectMember._id)
          .eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()
    if (existing) {
      if (existing.projectId !== args.projectId || existing.groupId !== args.groupId) {
        throw new Error('idempotency_scope_mismatch')
      }
      return existing._id
    }
    if (args.sourceMessageId) {
      const sourceMessage = await ctx.db.get(args.sourceMessageId)
      if (
        !sourceMessage ||
        sourceMessage.projectId !== args.projectId ||
        sourceMessage.groupId !== args.groupId ||
        sourceMessage.channelThreadId
      ) {
        throw new Error('thread_source_unavailable')
      }
      const sourceThread = await ctx.db
        .query('channelThreads')
        .withIndex('by_group_source', (q) =>
          q.eq('groupId', args.groupId).eq('sourceMessageId', args.sourceMessageId),
        )
        .unique()
      if (sourceThread) return sourceThread._id
    }
    const now = Date.now()
    const threadId = await ctx.db.insert('channelThreads', {
      projectId: args.projectId,
      groupId: args.groupId,
      name: validateChannelThreadName(args.name),
      sourceMessageId: args.sourceMessageId,
      creatorUserId: args.creatorId,
      creatorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      status: 'active',
      revision: 1,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    const thread = (await ctx.db.get(threadId))!
    await upsertThreadFollower(ctx, {
      thread,
      userId: args.creatorId,
      projectMember,
      actingCompanyId: access.companyAccess?.company._id,
      reason: 'created',
    })
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      channelThreadId: threadId,
      actorId: args.creatorId,
      actorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      entityType: 'channelThread',
      entityId: threadId,
      action: 'channel_thread.created',
      after: { name: thread.name, sourceMessageId: args.sourceMessageId },
    })
    return threadId
  },
})

export const setFollowing = mutation({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    following: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireThreadsEnabled()
    const { access, projectMember, thread } = await authorizeThread(ctx, args, 'writeChannel')
    await upsertThreadFollower(ctx, {
      thread,
      userId: args.userId,
      projectMember,
      actingCompanyId: access.companyAccess?.company._id,
      reason: 'explicit',
      preference: args.following ? 'following' : 'unfollowed',
    })
    return args.following
  },
})

export const markRead = mutation({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    requireThreadsEnabled()
    const { access, projectMember, thread } = await authorizeThread(ctx, args, 'writeChannel')
    const latestMessage = await ctx.db
      .query('messages')
      .withIndex('by_thread_created_at', (q) => q.eq('channelThreadId', thread._id))
      .order('desc')
      .first()
    const lastReadChannelSequence = latestMessage?.channelSequence ?? 0
    const existing = await ctx.db
      .query('channelThreadReadStates')
      .withIndex('by_thread_project_member', (q) =>
        q.eq('channelThreadId', thread._id).eq('projectMemberId', projectMember._id),
      )
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReadChannelSequence: Math.max(existing.lastReadChannelSequence, lastReadChannelSequence),
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert('channelThreadReadStates', {
      projectId: thread.projectId,
      groupId: thread.groupId,
      channelThreadId: thread._id,
      userId: args.userId,
      projectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      lastReadChannelSequence,
      createdAt: now,
      updatedAt: now,
    })
  },
})

async function updateThreadLifecycle(
  ctx: MutationCtx,
  args: {
    threadId: Id<'channelThreads'>
    userId: Id<'users'>
    actingCompanyId?: Id<'companies'>
    projectMemberId?: Id<'projectMembers'>
    expectedRevision: number
    status: 'active' | 'archived'
  },
) {
  const { access, projectMember, thread } = await authorizeThread(ctx, args, 'writeChannel')
  if (!await canManageThread(ctx, thread, projectMember)) throw new Error('thread_steward_required')
  if (thread.revision !== args.expectedRevision) {
    return { conflict: true, revision: thread.revision, status: thread.status, threadId: thread._id }
  }
  if (thread.status === args.status) {
    return { conflict: false, revision: thread.revision, status: thread.status, threadId: thread._id }
  }
  const now = Date.now()
  await ctx.db.patch(thread._id, {
    status: args.status,
    revision: thread.revision + 1,
    archivedAt: args.status === 'archived' ? now : undefined,
    updatedAt: now,
  })
  await appendAuditEvent(ctx, {
    projectId: thread.projectId,
    groupId: thread.groupId,
    channelThreadId: thread._id,
    actorId: args.userId,
    actorProjectMemberId: projectMember._id,
    actingCompanyId: access.companyAccess?.company._id,
    entityType: 'channelThread',
    entityId: thread._id,
    action: args.status === 'archived' ? 'channel_thread.archived' : 'channel_thread.reopened',
    before: { revision: thread.revision, status: thread.status },
    after: { revision: thread.revision + 1, status: args.status },
  })
  return { conflict: false, revision: thread.revision + 1, status: args.status, threadId: thread._id }
}

export const setStatus = mutation({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    expectedRevision: v.number(),
    status: threadStatus,
  },
  handler: async (ctx, args) => {
    requireThreadsEnabled()
    return await updateThreadLifecycle(ctx, args)
  },
})

export const rename = mutation({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    expectedRevision: v.number(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    requireThreadsEnabled()
    const { access, projectMember, thread } = await authorizeThread(ctx, args, 'writeChannel')
    if (!await canManageThread(ctx, thread, projectMember)) throw new Error('thread_steward_required')
    if (thread.revision !== args.expectedRevision) {
      return { conflict: true, name: thread.name, revision: thread.revision }
    }
    const name = validateChannelThreadName(args.name)
    const now = Date.now()
    await ctx.db.patch(thread._id, { name, revision: thread.revision + 1, updatedAt: now })
    await appendAuditEvent(ctx, {
      projectId: thread.projectId,
      groupId: thread.groupId,
      channelThreadId: thread._id,
      actorId: args.userId,
      actorProjectMemberId: projectMember._id,
      actingCompanyId: access.companyAccess?.company._id,
      entityType: 'channelThread',
      entityId: thread._id,
      action: 'channel_thread.renamed',
      before: { name: thread.name, revision: thread.revision },
      after: { name, revision: thread.revision + 1 },
    })
    return { conflict: false, name, revision: thread.revision + 1 }
  },
})
