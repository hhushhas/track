import { v } from 'convex/values'

import { query } from './_generated/server'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { threadsEnabled } from './lib/channelThreadPolicy'

const searchScope = v.union(
  v.literal('all'),
  v.literal('messages'),
  v.literal('files'),
  v.literal('groups'),
  v.literal('threads'),
)

function compactPreview(value: string, fallback = 'No preview available') {
  const preview = value.replace(/\s+/g, ' ').trim()
  if (!preview) return fallback
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview
}

function enabled(scope: string, candidate: string) {
  return scope === 'all' || scope === candidate
}

export const project = query({
  args: {
    filter: v.optional(searchScope),
    limit: v.optional(v.number()),
    projectId: v.id('projects'),
    query: v.string(),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readProject')

    const term = args.query.trim()
    const filter = args.filter ?? 'all'
    const perSectionLimit = Math.max(3, Math.min(args.limit ?? 8, 12))

    if (term.length < 2) {
      return {
        files: [],
        groups: [],
        messages: [],
        threads: [],
      }
    }

    const groupMemberships = access.companyAccess
      ? access.companyAccess.projectMember.status === 'archived'
        ? []
        : await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', access.companyAccess!.projectMember._id).eq('status', 'active'),
          ).collect()
      : await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect()
    const visibleGroupIds = new Set(
      (access.companyAccess?.entitlement?.channelIds ?? groupMemberships
        .filter((membership) => membership.projectId === args.projectId)
        .map((membership) => membership.groupId)).map(String),
    )
    const cutoff = access.companyAccess?.entitlement?.exitAt
    const channelSnapshots = new Map(
      (access.companyAccess?.entitlement?.channelSnapshots ?? []).map((channel: { _id: string; name: string }) => [channel._id, channel]),
    )
    const threadSnapshots = new Map(
      (access.companyAccess?.entitlement?.threadSnapshots ?? []).map((thread: {
        _id: string
        name: string
        status: 'active' | 'archived'
      }) => [thread._id, thread]),
    )

    const messages = enabled(filter, 'messages')
      ? await ctx.db
          .query('messages')
          .withSearchIndex('search_body_by_project', (q) =>
            q.search('body', term).eq('projectId', args.projectId),
          )
          .take(perSectionLimit * 2)
      : []
    const messageResults = (
      await Promise.all(
        messages
          .filter((message) => visibleGroupIds.has(String(message.groupId)) && (!cutoff || message.createdAt <= cutoff))
          .slice(0, perSectionLimit)
          .map(async (message) => {
            if (message.channelThreadId && !threadsEnabled()) return null
            if (cutoff && message.channelThreadId && !threadSnapshots.has(String(message.channelThreadId))) return null
            const [author, group, channelThread] = await Promise.all([
              ctx.db.get(message.authorId),
              ctx.db.get(message.groupId),
              message.channelThreadId ? ctx.db.get(message.channelThreadId) : null,
            ])
            const groupName = channelSnapshots.get(String(message.groupId))?.name ?? group?.name ?? 'Unknown channel'
            return {
              createdAt: message.createdAt,
              groupId: message.groupId,
              groupName,
              id: message._id,
              kind: 'message' as const,
              messageId: message._id,
              threadId: message.channelThreadId,
              threadName: message.channelThreadId
                ? threadSnapshots.get(String(message.channelThreadId))?.name ?? channelThread?.name
                : undefined,
              preview: compactPreview(message.body, 'Attachment message'),
              subtitle: channelThread
                ? `${author?.displayName ?? 'Unknown member'} in ${threadSnapshots.get(String(channelThread._id))?.name ?? channelThread.name} · ${groupName}`
                : `${author?.displayName ?? 'Unknown member'} in ${groupName}`,
              title: author?.displayName ?? 'Message',
            }
          }),
      )
    ).filter((result) => result !== null)

    const files = enabled(filter, 'files')
      ? await ctx.db
          .query('attachments')
          .withSearchIndex('search_filename_by_project', (q) =>
            q.search('filename', term).eq('projectId', args.projectId),
          )
          .take(perSectionLimit * 2)
      : []
    const fileResults = (
      await Promise.all(
        files
          .filter((file) => visibleGroupIds.has(String(file.groupId)) && (!cutoff || file.createdAt <= cutoff))
          .slice(0, perSectionLimit)
          .map(async (file) => {
            const [group, message] = await Promise.all([
              ctx.db.get(file.groupId),
              ctx.db.get(file.messageId),
            ])
            if (message?.channelThreadId && !threadsEnabled()) return null
            if (cutoff && message?.channelThreadId && !threadSnapshots.has(String(message.channelThreadId))) return null
            const channelThread = message?.channelThreadId
              ? await ctx.db.get(message.channelThreadId)
              : null
            const groupName = channelSnapshots.get(String(file.groupId))?.name ?? group?.name ?? 'Unknown channel'
            return {
              attachmentId: file._id,
              contentType: file.contentType,
              createdAt: file.createdAt,
              groupId: file.groupId,
              groupName,
              id: file._id,
              kind: 'file' as const,
              messageId: file.messageId,
              threadId: message?.channelThreadId,
              threadName: channelThread
                ? threadSnapshots.get(String(channelThread._id))?.name ?? channelThread.name
                : undefined,
              preview: `${file.contentType || 'file'} · ${file.size.toLocaleString()} bytes`,
              subtitle: groupName,
              title: file.filename,
            }
          }),
      )
    ).filter((result) => result !== null)

    const groups = enabled(filter, 'groups')
      ? await ctx.db
          .query('groups')
          .withSearchIndex('search_name_by_project', (q) =>
            q.search('name', term).eq('projectId', args.projectId),
          )
          .take(perSectionLimit * 2)
      : []
    const groupResults = groups
      .filter((group) => visibleGroupIds.has(String(group._id)))
      .slice(0, perSectionLimit)
      .map((group) => ({
        createdAt: group.createdAt,
        groupId: group._id,
        groupName: channelSnapshots.get(String(group._id))?.name ?? group.name,
        id: group._id,
        kind: 'group' as const,
        preview: `${group.kind.replaceAll('_', ' ')} group`,
        subtitle: 'Channel',
        title: channelSnapshots.get(String(group._id))?.name ?? group.name,
      }))

    const channelThreads = threadsEnabled() && enabled(filter, 'threads')
      ? await ctx.db
          .query('channelThreads')
          .withSearchIndex('search_name_by_project', (q) =>
            q.search('name', term).eq('projectId', args.projectId),
          )
          .take(perSectionLimit * 2)
      : []
    const threadResults = (
      await Promise.all(
        channelThreads
          .filter((thread) => visibleGroupIds.has(String(thread.groupId)) && (
            cutoff ? threadSnapshots.has(String(thread._id)) : true
          ))
          .slice(0, perSectionLimit)
          .map(async (thread) => {
            const group = await ctx.db.get(thread.groupId)
            const snapshot = threadSnapshots.get(String(thread._id))
            const groupName = channelSnapshots.get(String(thread.groupId))?.name ?? group?.name ?? 'Unknown channel'
            return {
              createdAt: thread.createdAt,
              groupId: thread.groupId,
              groupName,
              id: thread._id,
              kind: 'thread' as const,
              preview: (snapshot?.status ?? thread.status) === 'archived' ? 'Archived thread' : 'Active thread',
              subtitle: groupName,
              threadId: thread._id,
              threadName: snapshot?.name ?? thread.name,
              title: snapshot?.name ?? thread.name,
            }
          }),
      )
    )

    return {
      files: fileResults,
      groups: groupResults,
      messages: messageResults,
      threads: threadResults,
    }
  },
})
