import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'

export async function createTaskNotification(
  ctx: MutationCtx,
  input: {
    task: Doc<'tasks'>
    recipient: Doc<'projectMembers'>
    actorProjectMemberId?: Id<'projectMembers'>
    eventType: string
    payload: unknown
    idempotencyKey: string
  },
) {
  if (input.recipient._id === input.actorProjectMemberId) return
  if (input.recipient.projectId !== input.task.projectId ||
    (input.recipient.status !== undefined && input.recipient.status !== 'active')) return
  if (input.task.groupId) {
    const groupMember = await ctx.db.query('groupMembers')
      .withIndex('by_group_project_member', (q) =>
        q.eq('groupId', input.task.groupId!).eq('projectMemberId', input.recipient._id),
      ).unique()
    const legacyGroupMember = groupMember ?? await ctx.db.query('groupMembers')
      .withIndex('by_group_user', (q) =>
        q.eq('groupId', input.task.groupId!).eq('userId', input.recipient.userId),
      ).unique()
    if (!legacyGroupMember ||
      (legacyGroupMember.status !== undefined && legacyGroupMember.status !== 'active')) return
  }
  const existing = await ctx.db.query('taskNotifications')
    .withIndex('by_member_idempotency', (q) =>
      q.eq('recipientProjectMemberId', input.recipient._id).eq('idempotencyKey', input.idempotencyKey),
    ).unique()
  if (existing) return
  const notificationId = await ctx.db.insert('taskNotifications', {
    projectId: input.task.projectId,
    taskId: input.task._id,
    recipientProjectMemberId: input.recipient._id,
    recipientUserId: input.recipient.userId,
    originalGroupId: input.task.groupId,
    eventType: input.eventType,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    createdAt: Date.now(),
  })
  await ctx.scheduler.runAfter(0, (internal as any).pushNotifications.deliverTaskNotification, { notificationId })
}

export async function notifyTaskFollowers(
  ctx: MutationCtx,
  input: {
    task: Doc<'tasks'>
    actorProjectMemberId: Id<'projectMembers'>
    eventType: string
    payload: unknown
    idempotencyKey: string
  },
) {
  const followers = await ctx.db.query('taskFollowers')
    .withIndex('by_task_enabled', (q) => q.eq('taskId', input.task._id).eq('enabled', true))
    .collect()
  for (const follower of followers) {
    const recipient = await ctx.db.get(follower.projectMemberId)
    if (recipient) await createTaskNotification(ctx, { ...input, recipient })
  }
}
