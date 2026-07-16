import { v } from 'convex/values'

import { query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireAuthenticatedActor } from './lib/actorContext'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { resolveTaskRequestContext } from './lib/taskPolicy'

const searchScope = v.union(
  v.literal('all'),
  v.literal('messages'),
  v.literal('files'),
  v.literal('groups'),
  v.literal('tasks'),
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
            const [author, group] = await Promise.all([
              ctx.db.get(message.authorId),
              ctx.db.get(message.groupId),
            ])
            const groupName = channelSnapshots.get(String(message.groupId))?.name ?? group?.name ?? 'Unknown channel'
            return {
              createdAt: message.createdAt,
              groupId: message.groupId,
              groupName,
              id: message._id,
              kind: 'message' as const,
              messageId: message._id,
              preview: compactPreview(message.body, 'Attachment message'),
              subtitle: `${author?.displayName ?? 'Unknown member'} in ${groupName}`,
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
          .filter((file) => visibleGroupIds.has(String(file.groupId)) && (!cutoff || file.createdAt <= cutoff))
          .slice(0, perSectionLimit)
          .map(async (file) => {
            const group = await ctx.db.get(file.groupId)
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
              preview: `${file.contentType || 'file'} · ${file.size.toLocaleString()} bytes`,
              subtitle: groupName,
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

    const taskCandidates = process.env.TRACK_TASKS_ENABLED === 'true' && enabled(filter, 'tasks')
      ? access.companyAccess?.projectMember.status === 'archived' && access.companyAccess.entitlement
        ? (await ctx.db.query('taskArchiveSnapshots').withIndex('by_entitlement_table', (q) =>
            q.eq('entitlementId', access.companyAccess!.entitlement!._id).eq('sourceTable', 'tasks'),
          ).collect()).map((row) => row.payload as {
            _id: string; archivedAt?: number; boardId: string; dueDate?: string; groupId?: Id<'groups'>;
            priority: string; publicKey: string; searchText: string; title: string; workflowStateId: string; createdAt: number
          }).filter((task) => task.searchText.toLowerCase().includes(term.toLowerCase())).slice(0, perSectionLimit)
        : await ctx.db.query('tasks').withSearchIndex('search_tasks', (q) =>
            q.search('searchText', term).eq('projectId', args.projectId),
          ).take(perSectionLimit * 4)
      : []
    const actor = taskCandidates.length ? await requireAuthenticatedActor(ctx) : null
    const taskResults = []
    for (const task of taskCandidates) {
      if (task.archivedAt) continue
      if (!access.companyAccess?.entitlement) {
        try {
          const taskAccess = await resolveTaskRequestContext(ctx, actor!, args.projectId, args, task.groupId)
          if (task.groupId && !taskAccess.capabilities.canReadChannel) continue
        } catch {
          continue
        }
      }
      const archived = Boolean(access.companyAccess?.entitlement)
      const board = archived ? null : await ctx.db.get(task.boardId as Id<'taskBoards'>)
      const state = archived ? null : await ctx.db.get(task.workflowStateId as Id<'taskWorkflowStates'>)
      const assignee = archived || !('assigneeProjectMemberId' in task) || !task.assigneeProjectMemberId
        ? null : await ctx.db.get(task.assigneeProjectMemberId as Id<'projectMembers'>)
      taskResults.push({
        createdAt: task.createdAt,
        groupId: task.groupId,
        groupName: task.groupId ? 'Channel task' : 'Project task',
        id: String(task._id),
        kind: 'task' as const,
        preview: `${state?.name ?? 'Archived status'} · ${task.priority}${task.dueDate ? ` · due ${task.dueDate}` : ''}`,
        subtitle: `${board?.name ?? 'Archived board'}${assignee ? ' · assigned' : ''}`,
        taskKey: task.publicKey,
        title: task.title,
      })
      if (taskResults.length >= perSectionLimit) break
    }

    return {
      files: fileResults,
      groups: groupResults,
      messages: messageResults,
      tasks: taskResults,
    }
  },
})
