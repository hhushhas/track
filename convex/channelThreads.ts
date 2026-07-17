import { validateChannelThreadName } from '@track/shared/threads'
import { paginationOptsValidator } from 'convex/server'
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
  replyCount?: number
  latestReplyAt?: number
  latestChannelSequence?: number
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
  const unavailable = capability === 'readChannel' ? 'thread_unavailable' : 'thread_access_changed'
  const thread = await ctx.db.get(input.threadId)
  if (!thread) throw new Error(unavailable)
  let access
  try {
    access = await authorizeScopedRequest(ctx, {
      projectId: thread.projectId,
      groupId: thread.groupId,
      claimedUserId: input.userId,
      actingCompanyId: input.actingCompanyId,
      projectMemberId: input.projectMemberId,
    }, capability)
  } catch {
    throw new Error(unavailable)
  }
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
  const [follower, readState, sourceMessage] = await Promise.all([
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
  const following = snapshot?.following ?? follower?.preference === 'following'
  const latestChannelSequence = snapshot?.latestChannelSequence ?? thread.latestChannelSequence ?? 0
  const unread = following && latestChannelSequence >
    (snapshot?.lastReadChannelSequence ?? readState?.lastReadChannelSequence ?? 0)
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
    replyCount: snapshot?.replyCount ?? thread.replyCount ?? 0,
    latestReplyAt: snapshot?.latestReplyAt ?? thread.latestReplyAt ?? null,
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

export const listGroupUnread = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    if (!threadsEnabled()) return []
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readProject')
    const projectMember = await resolveActorProjectMember(
      ctx,
      args.projectId,
      args.userId,
      access.companyAccess?.projectMember,
    )
    const cutoff = access.companyAccess?.entitlement?.exitAt
    let visibleGroupIds: Set<string>
    if (access.companyAccess?.entitlement?.channelIds) {
      visibleGroupIds = new Set(access.companyAccess.entitlement.channelIds.map(String))
    } else if (access.companyAccess) {
      const memberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) =>
          q.eq('projectMemberId', projectMember._id).eq('status', 'active'),
        )
        .collect()
      visibleGroupIds = new Set(memberships.map((membership) => String(membership.groupId)))
    } else {
      const memberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .collect()
      visibleGroupIds = new Set(
        memberships
          .filter((membership) =>
            membership.projectId === args.projectId &&
            (!membership.status || membership.status === 'active'),
          )
          .map((membership) => String(membership.groupId)),
      )
    }
    const snapshots = new Map(
      (access.companyAccess?.entitlement?.threadSnapshots ?? [])
        .map((snapshot: ThreadSnapshot) => [String(snapshot._id), snapshot]),
    )
    const followers = await ctx.db
      .query('channelThreadFollowers')
      .withIndex('by_project_member_preference', (q) =>
        q.eq('projectMemberId', projectMember._id).eq('preference', 'following'),
      )
      .collect()
    const counts = new Map<string, number>()
    for (const follower of followers) {
      if (!visibleGroupIds.has(String(follower.groupId))) continue
      const snapshot = snapshots.get(String(follower.channelThreadId))
      if (cutoff && !snapshot) continue
      const [readState, thread] = await Promise.all([
        ctx.db.query('channelThreadReadStates').withIndex('by_thread_project_member', (q) =>
          q.eq('channelThreadId', follower.channelThreadId).eq('projectMemberId', projectMember._id),
        ).unique(),
        ctx.db.get(follower.channelThreadId),
      ])
      const latestChannelSequence = snapshot?.latestChannelSequence ?? thread?.latestChannelSequence ?? 0
      if (latestChannelSequence > (readState?.lastReadChannelSequence ?? 0)) {
        counts.set(String(follower.groupId), (counts.get(String(follower.groupId)) ?? 0) + 1)
      }
    }
    return [...counts].map(([groupId, unreadCount]) => ({
      groupId: groupId as Id<'groups'>,
      unreadCount,
    }))
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
    try {
      const { access, cutoff, thread } = await authorizeThread(ctx, args)
      const snapshots = access.companyAccess?.entitlement?.threadSnapshots ?? []
      if (cutoff && !snapshots.some((snapshot: { _id?: Id<'channelThreads'> }) => snapshot._id === thread._id)) {
        return []
      }
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
          access.companyAccess?.entitlement?.channelSnapshots,
          snapshots,
          access.companyAccess?.entitlement?.memberSnapshots,
        ),
      ))
    } catch {
      return []
    }
  },
})

export const listMessagePage = query({
  args: {
    threadId: v.id('channelThreads'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    targetMessageId: v.optional(v.id('messages')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (!threadsEnabled()) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    try {
      const { access, cutoff, thread } = await authorizeThread(ctx, args)
      const snapshots = access.companyAccess?.entitlement?.threadSnapshots ?? []
      if (cutoff && !snapshots.some((snapshot: { _id?: Id<'channelThreads'> }) => snapshot._id === thread._id)) {
        return { page: [], isDone: true, continueCursor: '' }
      }
      const result = await ctx.db
        .query('messages')
        .withIndex('by_thread_created_at', (q) => cutoff
          ? q.eq('channelThreadId', thread._id).lte('createdAt', cutoff)
          : q.eq('channelThreadId', thread._id))
        .order('desc')
        .paginate(args.paginationOpts)
      const page = [...result.page]
      if (args.paginationOpts.cursor === null && args.targetMessageId) {
        const target = await ctx.db.get(args.targetMessageId)
        if (
          target?.channelThreadId === thread._id &&
          (!cutoff || target.createdAt <= cutoff) &&
          !page.some((message) => message._id === target._id)
        ) page.push(target)
      }
      return {
        ...result,
        page: await Promise.all(page.map(async (message) =>
          await buildMessageDetail(
            ctx,
            message,
            args.userId,
            args.projectMemberId,
            cutoff,
            access.companyAccess?.entitlement?.channelSnapshots,
            snapshots,
            access.companyAccess?.entitlement?.memberSnapshots,
          ),
        )),
      }
    } catch {
      return { page: [], isDone: true, continueCursor: '' }
    }
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
      replyCount: 0,
      latestChannelSequence: 0,
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
    const { access, cutoff, projectMember, thread } = await authorizeThread(ctx, args)
    if (cutoff) throw new Error('archive_read_state_immutable')
    const lastReadChannelSequence = thread.latestChannelSequence ?? 0
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
