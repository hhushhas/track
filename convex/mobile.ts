import { v } from 'convex/values'
import { resolveReleaseFeatureFlag } from '@track/shared/feature-flags'
import { isTerminalTaskState } from '@track/shared/tasks'

import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { assertActorMatches, requireAuthenticatedActor } from './lib/actorContext'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { requireActiveCompanyMembership, requireCompanyModelEnabled } from './lib/companyPolicy'
import { requireTaskAccess } from './lib/taskPolicy'
import { taskView } from './lib/taskData'
import { threadsEnabled } from './lib/channelThreadPolicy'
import { suggestionAccess, suggestionReferenceVisible } from './taskSuggestions'
import { normalizeEmail } from './lib/companyInvitations'

const platform = v.union(v.literal('web'), v.literal('ios'), v.literal('android'))

async function getGroupUnreadCount(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  projectMemberId?: Id<'projectMembers'>,
  cutoff?: number,
) {
  const group = await ctx.db.get(groupId)
  if (!group) return 0
  const resolvedProjectMemberId = projectMemberId ?? (await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', group.projectId).eq('userId', userId),
    )
    .unique())?._id
  const readState = projectMemberId
    ? await ctx.db.query('groupReadStates').withIndex('by_project_member_group', (q) =>
        q.eq('projectMemberId', projectMemberId).eq('groupId', groupId),
      ).unique()
    : await ctx.db.query('groupReadStates').withIndex('by_user_group', (q) =>
        q.eq('userId', userId).eq('groupId', groupId),
      ).unique()
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_group_thread_created_at', (q) =>
      q.eq('groupId', groupId).eq('channelThreadId', undefined),
    )
    .collect()

  const timelineUnread = messages.filter((message) => {
    if (cutoff && message.createdAt > cutoff) return false
    const authoredBySelectedMembership = message.authorProjectMemberId
      ? message.authorProjectMemberId === resolvedProjectMemberId
      : message.authorId === userId
    if (authoredBySelectedMembership) return false
    if (!readState) return true
    return message.createdAt > readState.lastReadAt
  }).length
  if (!threadsEnabled() || !resolvedProjectMemberId) return timelineUnread

  const followedThreads = await ctx.db
    .query('channelThreadFollowers')
    .withIndex('by_project_member_preference', (q) =>
      q.eq('projectMemberId', resolvedProjectMemberId).eq('preference', 'following'),
    )
    .collect()
  const threadUnread = (await Promise.all(
    followedThreads
      .filter((follower) => follower.groupId === groupId)
      .map(async (follower) => {
        const readState = await ctx.db
          .query('channelThreadReadStates')
          .withIndex('by_thread_project_member', (q) =>
            q
              .eq('channelThreadId', follower.channelThreadId)
              .eq('projectMemberId', resolvedProjectMemberId),
          )
          .unique()
        const thread = await ctx.db.get(follower.channelThreadId)
        const latestChannelSequence = cutoff
          ? (await ctx.db
              .query('messages')
              .withIndex('by_thread_created_at', (q) =>
                q.eq('channelThreadId', follower.channelThreadId).lte('createdAt', cutoff),
              )
              .order('desc')
              .first())?.channelSequence ?? 0
          : thread?.latestChannelSequence ?? 0
        return latestChannelSequence > (readState?.lastReadChannelSequence ?? 0) ? 1 : 0
      }),
  )).reduce<number>((total, count) => total + count, 0)
  return timelineUnread + threadUnread
}

export const listProjects = query({
  args: {
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    if (args.actingCompanyId) {
      requireCompanyModelEnabled()
      await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId)
    }
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const rows = await Promise.all(
      memberships.filter((membership) => args.actingCompanyId
        ? membership.companyId === args.actingCompanyId && (membership.status === 'active' || membership.status === 'archived')
        : !membership.companyId,
      ).map(async (membership) => {
        const project = await ctx.db.get(membership.projectId)
        if (!project) return null
        const groupMemberships = membership.companyId
          ? membership.status === 'archived'
            ? []
            : await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
                q.eq('projectMemberId', membership._id).eq('status', 'active'),
              ).collect()
          : await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect()
        const entitlement = membership.status === 'archived'
          ? await ctx.db.query('projectArchiveEntitlements').withIndex('by_member', (q) => q.eq('projectMemberId', membership._id)).unique()
          : null
        if (membership.status === 'archived' && entitlement?.retentionStatus !== 'active') return null
        const projectGroupMemberships = entitlement
          ? entitlement.channelIds.map((groupId) => ({ groupId }))
          : groupMemberships.filter((item) => item.projectId === project._id)
        const unreadCount = (
          await Promise.all(
            projectGroupMemberships.map((item) =>
              getGroupUnreadCount(
                ctx,
                item.groupId,
                args.userId,
                membership.companyId ? membership._id : undefined,
                entitlement?.exitAt,
              ),
            ),
          )
        ).reduce((total, count) => total + count, 0)

        return {
          project: entitlement?.projectSnapshot ?? project,
          membership,
          groupCount: projectGroupMemberships.length,
          unreadCount,
        }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

/**
 * Returns the authenticated user's unread task events across the projects
 * visible in the current mobile workspace. This is intentionally a small
 * action queue, not a second task list: each row points to the task that needs
 * attention and can be marked read from the Inbox.
 */
export const listAttention = query({
  args: {
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const tasksEnabled = resolveReleaseFeatureFlag(process.env.TRACK_TASKS_ENABLED)
    if (args.actingCompanyId) {
      requireCompanyModelEnabled()
      await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId)
    }

    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .take(100)

    const rows = tasksEnabled ? await Promise.all(
      memberships
        .filter((membership) =>
          membership.status === 'active' &&
          (args.actingCompanyId
            ? membership.companyId === args.actingCompanyId
            : !membership.companyId),
        )
        .map(async (membership) => {
          const project = await ctx.db.get(membership.projectId)
          if (!project) return []
          const notifications = await ctx.db
            .query('taskNotifications')
            .withIndex('by_member_read', (q) =>
              q.eq('recipientProjectMemberId', membership._id).eq('readAt', undefined),
            )
            .order('desc')
            .take(50)

          const visible = []
          for (const notification of notifications) {
            if (notification.readAt !== undefined) continue
            const task = await ctx.db.get(notification.taskId)
            if (!task || task.archivedAt || notification.recipientUserId !== args.userId) continue
            try {
              await requireTaskAccess(ctx, actor, task._id, {
                ...(membership.companyId
                  ? { actingCompanyId: membership.companyId, projectMemberId: membership._id }
                  : {}),
              })
            } catch {
              continue
            }
            visible.push({
              kind: 'task' as const,
              id: notification._id,
              projectId: project._id,
              projectName: project.name,
              companyId: membership.companyId,
              membershipId: membership._id,
              taskId: task._id,
              taskKey: task.publicKey,
              taskTitle: task.title,
              eventType: notification.eventType,
              createdAt: notification.createdAt,
            })
          }
          return visible
        }),
    ) : []

    const suggestionRows = tasksEnabled ? await Promise.all(
      memberships
        .filter((membership) => membership.status === 'active' &&
          (args.actingCompanyId ? membership.companyId === args.actingCompanyId : !membership.companyId))
        .map(async (membership) => {
          const project = await ctx.db.get(membership.projectId)
          if (!project) return []
          const suggestions = await ctx.db.query('taskSuggestions')
            .withIndex('by_project_status', (q) =>
              q.eq('projectId', membership.projectId).eq('status', 'pending').eq('archivedAt', undefined),
            ).take(20)
          const visible = []
          for (const suggestion of suggestions) {
            try {
              const identity = membership.companyId
                ? { actingCompanyId: membership.companyId, projectMemberId: membership._id }
                : {}
              const access = await suggestionAccess(ctx, actor, suggestion, identity)
              const hidden = await ctx.db.query('taskSuggestionHides')
                .withIndex('by_member_suggestion', (q) =>
                  q.eq('projectMemberId', access.projectMember._id).eq('suggestionId', suggestion._id),
                ).unique()
              if (hidden) continue
              const references = await ctx.db.query('taskSuggestionReferences')
                .withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestion._id)).collect()
              if (!references.length || !(await Promise.all(references.map((reference) => suggestionReferenceVisible(ctx, reference)))).every(Boolean)) continue
              visible.push({
                kind: 'suggestion' as const,
                id: suggestion._id,
                projectId: project._id,
                projectName: project.name,
                companyId: membership.companyId,
                membershipId: membership._id,
                groupId: suggestion.groupId,
                suggestionId: suggestion._id,
                title: suggestion.proposedTitle,
                preview: suggestion.proposedDescription ?? suggestion.groundingReason,
                eventType: 'task_suggestion',
                createdAt: suggestion.createdAt,
              })
            } catch {
              continue
            }
          }
          return visible
        }),
    ) : []

    const invitationRows = !args.actingCompanyId && resolveReleaseFeatureFlag(process.env.TRACK_COMPANY_MODEL_ENABLED)
      ? await (async () => {
          const invitations = await ctx.db.query('companyInvitations')
            .withIndex('by_email_status', (q) =>
              q.eq('normalizedEmail', normalizeEmail(actor.user.email)).eq('status', 'pending'),
            ).take(20)
          return await Promise.all(invitations.map(async (invitation) => {
            const company = await ctx.db.get(invitation.companyId)
            if (!company || company.status !== 'active' || invitation.expiresAt <= Date.now()) return null
            return {
              kind: 'invitation' as const,
              id: invitation._id,
              projectId: undefined,
              projectName: company.displayName,
              companyId: company._id,
              invitationId: invitation._id,
              title: `Join ${company.displayName}`,
              preview: `You were invited as a ${invitation.role}.`,
              eventType: 'company_invitation',
              createdAt: invitation.createdAt,
            }
          })).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null))
        })()
      : []

    const maxAttentionChannelScans = 60
    const channelCandidates: Array<{
      membership: Doc<'projectMembers'>
      groupMembership: Doc<'groupMembers'>
    }> = []
    for (const membership of memberships.filter((candidate) =>
      candidate.status === 'active' &&
      (args.actingCompanyId
        ? candidate.companyId === args.actingCompanyId
        : !candidate.companyId),
    )) {
      if (channelCandidates.length >= maxAttentionChannelScans) break
      const project = await ctx.db.get(membership.projectId)
      if (!project) continue
      const groupMemberships = membership.companyId
        ? await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', membership._id).eq('status', 'active'),
          ).take(maxAttentionChannelScans)
        : (await ctx.db.query('groupMembers').withIndex('by_user', (q) =>
            q.eq('userId', args.userId),
          ).take(maxAttentionChannelScans)).filter((item) => item.projectId === project._id)
      for (const groupMembership of groupMemberships) {
        if (channelCandidates.length >= maxAttentionChannelScans) break
        channelCandidates.push({ membership, groupMembership })
      }
    }

    const messageRows = await Promise.all(channelCandidates.map(async ({ membership, groupMembership }) => {
          const project = await ctx.db.get(membership.projectId)
          if (!project) return []
            const group = await ctx.db.get(groupMembership.groupId)
            if (!group || group.status !== 'active') return []
            try {
              await authorizeScopedRequest(ctx, {
                projectId: project._id,
                groupId: group._id,
                claimedUserId: args.userId,
                ...(membership.companyId
                  ? { actingCompanyId: membership.companyId, projectMemberId: membership._id }
                  : {}),
              }, 'readChannel')
            } catch {
              return []
            }
            const readState = membership.companyId
              ? await ctx.db.query('groupReadStates')
                  .withIndex('by_project_member_group', (q) =>
                    q.eq('projectMemberId', membership._id).eq('groupId', group._id),
                  ).unique()
              : await ctx.db.query('groupReadStates')
                  .withIndex('by_user_group', (q) =>
                    q.eq('userId', args.userId).eq('groupId', group._id),
                  ).unique()
            // The Inbox is a current-attention queue, so bound each Channel
            // scan while keeping the newest relevant work available. A
            // purpose-built mention index can replace this when attention
            // volume warrants it without making the query unbounded today.
            const messages = await ctx.db.query('messages')
              .withIndex('by_group_created_at', (q) => q.eq('groupId', group._id))
              .order('desc')
              .take(100)
            const rows = []
            for (const message of messages) {
              if (message.authorId === args.userId) continue
              const mentioned = message.mentionedProjectMemberIds
                ? message.mentionedProjectMemberIds.includes(membership._id)
                : message.mentions.includes(args.userId)
              const reply = message.replyToMessageId
                ? await ctx.db.get(message.replyToMessageId)
                : null
              const directReply = Boolean(
                reply && reply.authorId === args.userId &&
                (!reply.authorProjectMemberId || reply.authorProjectMemberId === membership._id),
              )
              if (!mentioned && !directReply) continue
              const threadReadState = message.channelThreadId
                ? await ctx.db.query('channelThreadReadStates').withIndex('by_thread_project_member', (q) =>
                    q.eq('channelThreadId', message.channelThreadId!).eq('projectMemberId', membership._id),
                  ).unique()
                : null
              const unread = message.channelThreadId
                ? (message.channelSequence ?? 0) > (threadReadState?.lastReadChannelSequence ?? 0)
                : !readState || message.createdAt > readState.lastReadAt
              if (!unread) continue
              const author = await ctx.db.get(message.authorId)
              const thread = message.channelThreadId ? await ctx.db.get(message.channelThreadId) : null
              rows.push({
                kind: 'message' as const,
                id: message._id,
                projectId: project._id,
                projectName: project.name,
                membershipId: membership._id,
                companyId: membership.companyId,
                groupId: group._id,
                groupName: group.name,
                messageId: message._id,
                threadId: message.channelThreadId,
                threadName: thread?.name,
                senderName: author?.displayName ?? 'A teammate',
                preview: message.body || message.notificationPreview || 'Sent an attachment.',
                eventType: mentioned ? 'mention' : 'direct_reply',
                createdAt: message.createdAt,
              })
            }
            return rows
    }))

    return [
      ...rows.flat(),
      ...suggestionRows.flat(),
      ...messageRows.flat(),
      ...invitationRows,
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
  },
})

/**
 * Returns the authenticated user's assigned work across the visible Projects.
 * This is the mobile equivalent of a global My Tasks view: Project scope is
 * still enforced per task, but a Project must not be selected just to review
 * work already assigned to the actor.
 */
export const listMyTasks = query({
  args: {
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    openOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    if (!resolveReleaseFeatureFlag(process.env.TRACK_TASKS_ENABLED)) return []
    if (args.actingCompanyId) {
      requireCompanyModelEnabled()
      await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId)
    }

    const memberships = await ctx.db.query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .take(100)
    const visibleMemberships = memberships.filter((membership) =>
      membership.status === 'active' && (args.actingCompanyId
        ? membership.companyId === args.actingCompanyId
        : !membership.companyId),
    )
    const rows = []

    for (const membership of visibleMemberships) {
      const project = await ctx.db.get(membership.projectId)
      if (!project) continue
      const identity = membership.companyId
        ? { actingCompanyId: membership.companyId, projectMemberId: membership._id }
        : {}
      const tasks = await ctx.db.query('tasks')
        .withIndex('by_assignee_archived', (q) =>
          q.eq('assigneeProjectMemberId', membership._id).eq('archivedAt', undefined),
        )
        .order('desc')
        .take(100)

      for (const task of tasks) {
        if (task.projectId !== project._id || task.archivedAt) continue
        try {
          const access = await requireTaskAccess(ctx, actor, task._id, identity)
          if (!access.taskCapabilities.canView) continue
          const view = await taskView(ctx, task)
          if (args.openOnly && (!view.state || isTerminalTaskState(view.state.category))) continue
          rows.push({
            ...view,
            project: { _id: project._id, name: project.name },
            companyId: membership.companyId,
            projectMemberId: membership._id,
          })
        } catch {
          // A task can become inaccessible when Project or Channel membership
          // changes. Do not let one stale assignment hide the rest of My Tasks.
        }
      }
    }

    return rows
      .sort((a, b) => (a.task.dueDate ?? '9999-12-31').localeCompare(b.task.dueDate ?? '9999-12-31') || b.task.updatedAt - a.task.updatedAt)
      .slice(0, 100)
  }
})

export const resolveNavigation = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    try {
      const access = await authorizeScopedRequest(ctx, {
        projectId: args.projectId,
        groupId: args.groupId,
        claimedUserId: args.userId,
        actingCompanyId: args.actingCompanyId,
        projectMemberId: args.projectMemberId,
      }, args.groupId ? 'readChannel' : 'readProject')
      const group = args.groupId ? await ctx.db.get(args.groupId) : null
      if (args.groupId && (!group || group.projectId !== args.projectId)) {
        return { available: false, archived: false, readStateImmutable: false }
      }
      const readStateImmutable = access.companyAccess?.projectMember.status === 'archived'
      return {
        available: true,
        archived:
          readStateImmutable ||
          access.project.status === 'archived' ||
          Boolean(group?.status && group.status !== 'active'),
        readStateImmutable,
      }
    } catch {
      return { available: false, archived: false, readStateImmutable: false }
    }
  },
})

export const listProjectMembers = query({
  args: {
    projectId: v.id('projects'),
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
    if (access.companyAccess?.entitlement) {
      return access.companyAccess.entitlement.memberSnapshots ?? []
    }
    const memberships = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect()
    const visible = access.companyAccess
      ? memberships.filter((membership) => membership.status === 'active')
      : memberships.filter((membership) => !membership.companyId)
    return await Promise.all(visible.map(async (membership) => {
      const [user, company] = await Promise.all([
        ctx.db.get(membership.userId),
        membership.companyId ? ctx.db.get(membership.companyId) : null,
      ])
      return {
        membership,
        user,
        company: company ? { _id: company._id, displayName: company.displayName } : null,
      }
    }))
  },
})

export const listGroups = query({
  args: {
    projectId: v.id('projects'),
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
    const memberships = access.companyAccess
      ? access.companyAccess.projectMember.status === 'archived'
        ? []
        : await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', access.companyAccess!.projectMember._id).eq('status', 'active'),
          ).collect()
      : await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect()
    const visibleMemberships = access.companyAccess?.entitlement
      ? access.companyAccess.entitlement.channelIds.map((groupId) => ({ groupId, projectId: args.projectId, _id: groupId }))
      : memberships.filter((membership) => membership.projectId === args.projectId)

    const rows = await Promise.all(
      visibleMemberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId)
        if (!group) return null
        const cutoff = access.companyAccess?.entitlement?.exitAt
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_group_thread_created_at', (q) => cutoff
            ? q.eq('groupId', group._id).eq('channelThreadId', undefined).lte('createdAt', cutoff)
            : q.eq('groupId', group._id).eq('channelThreadId', undefined))
          .order('desc')
          .first()
        const unreadCount = await getGroupUnreadCount(ctx, group._id, args.userId, args.projectMemberId, cutoff)
        const snapshot = access.companyAccess?.entitlement?.channelSnapshots.find((item: { _id?: string }) => item._id === group._id)
        return { group: snapshot ?? group, membership, lastMessage, unreadCount }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

export const getLastActiveContext = query({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const byDevice = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : null
    if (byDevice) return byDevice

    return await ctx.db
      .query('lastActiveContexts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .first()
  },
})

export const setLastActiveContext = mutation({
  args: {
    userId: v.id('users'),
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    deviceId: v.optional(v.string()),
    platform: v.optional(platform),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    if (args.projectId) await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, args.groupId ? 'readChannel' : 'readProject')

    const now = Date.now()
    const existing = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user', (q) => q.eq('userId', args.userId))
          .first()

    const payload = {
      projectId: args.projectId,
      groupId: args.groupId,
      deviceId: args.deviceId,
      platform: args.platform,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }
    return await ctx.db.insert('lastActiveContexts', {
      userId: args.userId,
      ...payload,
    })
  },
})

export const markGroupRead = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    lastReadMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('group_not_found')
    const access = await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    if (access.companyAccess?.projectMember.status === 'archived') throw new Error('archive_read_state_immutable')
    if (args.lastReadMessageId) {
      const message = await ctx.db.get(args.lastReadMessageId)
      if (!message || message.groupId !== args.groupId || message.channelThreadId) {
        throw new Error('message_not_found')
      }
    }

    const now = Date.now()
    const scopedProjectMemberId = args.actingCompanyId ? args.projectMemberId : undefined
    const existing = scopedProjectMemberId
      ? await ctx.db.query('groupReadStates').withIndex('by_project_member_group', (q) =>
          q.eq('projectMemberId', scopedProjectMemberId).eq('groupId', args.groupId),
        ).unique()
      : await ctx.db.query('groupReadStates').withIndex('by_user_group', (q) =>
          q.eq('userId', args.userId).eq('groupId', args.groupId),
        ).unique()
    const payload = {
      projectId: group.projectId,
      groupId: args.groupId,
      userId: args.userId,
      projectMemberId: scopedProjectMemberId,
      lastReadMessageId: args.lastReadMessageId,
      lastReadAt: now,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert('groupReadStates', {
      ...payload,
      createdAt: now,
    })
  },
})
