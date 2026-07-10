import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireProjectMember } from './lib/permissions'

const searchScope = v.union(
  v.literal('all'),
  v.literal('messages'),
  v.literal('files'),
  v.literal('groups'),
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
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)

    const term = args.query.trim()
    const filter = args.filter ?? 'all'
    const perSectionLimit = Math.max(3, Math.min(args.limit ?? 8, 12))

    if (term.length < 2) {
      return {
        files: [],
        groups: [],
        messages: [],
      }
    }

    const groupMemberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    const visibleGroupIds = new Set(
      groupMemberships
        .filter((membership) => membership.projectId === args.projectId)
        .map((membership) => membership.groupId),
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
          .filter((message) => visibleGroupIds.has(message.groupId))
          .slice(0, perSectionLimit)
          .map(async (message) => {
            const [author, group] = await Promise.all([
              ctx.db.get(message.authorId),
              ctx.db.get(message.groupId),
            ])
            return {
              createdAt: message.createdAt,
              groupId: message.groupId,
              groupName: group?.name ?? 'Unknown group',
              id: message._id,
              kind: 'message' as const,
              messageId: message._id,
              preview: compactPreview(message.body, 'Attachment message'),
              subtitle: `${author?.displayName ?? 'Unknown member'} in ${group?.name ?? 'Unknown group'}`,
              title: author?.displayName ?? 'Message',
            }
          }),
      )
    )

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
          .filter((file) => visibleGroupIds.has(file.groupId))
          .slice(0, perSectionLimit)
          .map(async (file) => {
            const group = await ctx.db.get(file.groupId)
            return {
              attachmentId: file._id,
              contentType: file.contentType,
              createdAt: file.createdAt,
              groupId: file.groupId,
              groupName: group?.name ?? 'Unknown group',
              id: file._id,
              kind: 'file' as const,
              messageId: file.messageId,
              preview: `${file.contentType || 'file'} · ${file.size.toLocaleString()} bytes`,
              subtitle: group?.name ?? 'Unknown group',
              title: file.filename,
            }
          }),
      )
    )

    const groups = enabled(filter, 'groups')
      ? await ctx.db
          .query('groups')
          .withSearchIndex('search_name_by_project', (q) =>
            q.search('name', term).eq('projectId', args.projectId),
          )
          .take(perSectionLimit * 2)
      : []
    const groupResults = groups
      .filter((group) => visibleGroupIds.has(group._id))
      .slice(0, perSectionLimit)
      .map((group) => ({
        createdAt: group.createdAt,
        groupId: group._id,
        groupName: group.name,
        id: group._id,
        kind: 'group' as const,
        preview: `${group.kind.replaceAll('_', ' ')} group`,
        subtitle: 'Group',
        title: group.name,
      }))

    return {
      files: fileResults,
      groups: groupResults,
      messages: messageResults,
    }
  },
})
