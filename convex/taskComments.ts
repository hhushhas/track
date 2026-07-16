import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import { appendTaskActivity } from './lib/taskData'
import { createTaskNotification, notifyTaskFollowers } from './lib/taskNotifications'
import { requireEligibleTaskMember, requireTaskAccess, resolveTaskRequestContext } from './lib/taskPolicy'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

function validateCommentBody(body: string) {
  const value = body.trim()
  if (!value || value.length > 10_000) throw new Error('task_comment_invalid')
  return value
}

export const create = mutation({
  args: {
    taskId: v.id('tasks'),
    body: v.string(),
    mentionedProjectMemberIds: v.array(v.id('projectMembers')),
    idempotencyKey: v.string(),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canComment) throw new Error('task_comment_forbidden')
    const existing = await ctx.db.query('taskComments')
      .withIndex('by_task_idempotency', (q) =>
        q.eq('taskId', access.task._id).eq('idempotencyKey', args.idempotencyKey),
      ).unique()
    if (existing) return existing._id

    const mentions = []
    for (const projectMemberId of new Set(args.mentionedProjectMemberIds)) {
      mentions.push(await requireEligibleTaskMember(ctx, {
        projectId: access.task.projectId,
        groupId: access.task.groupId,
        projectMemberId,
      }))
    }
    const now = Date.now()
    const commentId = await ctx.db.insert('taskComments', {
      projectId: access.task.projectId,
      taskId: access.task._id,
      originalGroupId: access.task.groupId,
      authorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      body: validateCommentBody(args.body),
      mentionedProjectMemberIds: mentions.map((member) => member._id),
      revision: 1,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    const follower = await ctx.db.query('taskFollowers').withIndex('by_task_member', (q) =>
      q.eq('taskId', access.task._id).eq('projectMemberId', access.projectMember._id),
    ).unique()
    if (!follower) await ctx.db.insert('taskFollowers', {
      projectId: access.task.projectId,
      taskId: access.task._id,
      userId: actor.userId,
      projectMemberId: access.projectMember._id,
      reason: 'commenter',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    await appendTaskActivity(ctx, {
      task: access.task, action: 'commented', actorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId, after: { commentId }, correlationId: args.idempotencyKey,
    })
    await notifyTaskFollowers(ctx, {
      task: access.task,
      actorProjectMemberId: access.projectMember._id,
      eventType: 'comment',
      payload: { publicKey: access.task.publicKey },
      idempotencyKey: `comment:${commentId}`,
    })
    for (const recipient of mentions) {
      await createTaskNotification(ctx, {
        task: access.task,
        recipient,
        actorProjectMemberId: access.projectMember._id,
        eventType: 'mention',
        payload: { publicKey: access.task.publicKey },
        idempotencyKey: `mention:${commentId}:${recipient._id}`,
      })
    }
    return commentId
  },
})

export const edit = mutation({
  args: { commentId: v.id('taskComments'), expectedRevision: v.number(), body: v.string(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('task_access_changed')
    const access = await requireTaskAccess(ctx, actor, comment.taskId, args)
    if (comment.authorProjectMemberId !== access.projectMember._id) throw new Error('task_comment_edit_forbidden')
    if (comment.originalGroupId && comment.originalGroupId !== access.task.groupId) {
      const originalAccess = await resolveTaskRequestContext(
        ctx, actor, comment.projectId, args, comment.originalGroupId,
      )
      if (!originalAccess.capabilities.canReadChannel) throw new Error('task_access_changed')
    }
    if (comment.revision !== args.expectedRevision) throw new Error(`task_conflict:${comment.revision}`)
    await ctx.db.patch(comment._id, {
      body: validateCommentBody(args.body), revision: comment.revision + 1, updatedAt: Date.now(),
    })
    await appendAuditEvent(ctx, {
      projectId: comment.projectId, groupId: comment.originalGroupId, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
      entityType: 'task_comment', entityId: String(comment._id), action: 'edited',
    })
    return comment.revision + 1
  },
})

export const archive = mutation({
  args: { commentId: v.id('taskComments'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('task_access_changed')
    const access = await requireTaskAccess(ctx, actor, comment.taskId, args)
    if (comment.originalGroupId && comment.originalGroupId !== access.task.groupId) {
      const originalAccess = await resolveTaskRequestContext(
        ctx, actor, comment.projectId, args, comment.originalGroupId,
      )
      if (!originalAccess.capabilities.canReadChannel) throw new Error('task_access_changed')
    }
    if (comment.authorProjectMemberId !== access.projectMember._id && !access.taskCapabilities.canArchive) {
      throw new Error('task_comment_archive_forbidden')
    }
    await ctx.db.patch(comment._id, { archivedAt: Date.now(), updatedAt: Date.now() })
    if (comment.authorProjectMemberId !== access.projectMember._id) await appendAuditEvent(ctx, {
      projectId: comment.projectId, groupId: comment.originalGroupId, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
      entityType: 'task_comment', entityId: String(comment._id), action: 'administratively_archived',
    })
    return comment._id
  },
})
