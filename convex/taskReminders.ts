import { isTerminalTaskState } from '@track/shared/tasks'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { createTaskNotification } from './lib/taskNotifications'

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-')
}

export function reminderTimeUtc(date: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  let candidate = Date.UTC(year, month - 1, day, 9)
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
      const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
      candidate += Date.UTC(year, month - 1, day, 9) - observed
    }
    return candidate
  } catch {
    return Date.UTC(year, month - 1, day, 9)
  }
}

export async function rescheduleTaskReminders(ctx: MutationCtx, task: Doc<'tasks'>) {
  const existing = await ctx.db.query('taskReminderJobs')
    .withIndex('by_task_status', (q) => q.eq('taskId', task._id).eq('status', 'scheduled')).collect()
  for (const job of existing) {
    if (job.scheduledJobId) await ctx.scheduler.cancel(job.scheduledJobId)
    await ctx.db.patch(job._id, { status: 'canceled', updatedAt: Date.now() })
  }
  if (!task.dueDate || !task.assigneeProjectMemberId || task.archivedAt) return
  const [board, state, member] = await Promise.all([
    ctx.db.get(task.boardId), ctx.db.get(task.workflowStateId), ctx.db.get(task.assigneeProjectMemberId),
  ])
  if (!board || board.archivedAt || !state || isTerminalTaskState(state.category) || !member ||
    (member.status !== undefined && member.status !== 'active')) return
  const user = await ctx.db.get(member.userId)
  if (!user) return
  const timezone = user.timezone ?? 'UTC'
  for (const reminder of [
    { kind: 'due_soon' as const, date: addCalendarDays(task.dueDate, -1) },
    { kind: 'overdue' as const, date: addCalendarDays(task.dueDate, 1) },
  ]) {
    const scheduledAt = reminderTimeUtc(reminder.date, timezone)
    if (scheduledAt <= Date.now()) continue
    const now = Date.now()
    const idempotencyKey = `${task._id}:${task.dueDate}:${member._id}:${reminder.kind}`
    const jobId = await ctx.db.insert('taskReminderJobs', {
      projectId: task.projectId, taskId: task._id,
      recipientProjectMemberId: member._id, recipientUserId: member.userId,
      kind: reminder.kind, dueDate: task.dueDate, status: 'scheduled', idempotencyKey,
      createdAt: now, updatedAt: now,
    })
    const scheduledJobId = await ctx.scheduler.runAt(
      scheduledAt, (internal as any).taskReminders.deliver, { jobId },
    )
    await ctx.db.patch(jobId, { scheduledJobId, updatedAt: Date.now() })
  }
}

export const deliver = internalMutation({
  args: { jobId: v.id('taskReminderJobs') },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== 'scheduled') return false
    const [task, member] = await Promise.all([ctx.db.get(job.taskId), ctx.db.get(job.recipientProjectMemberId)])
    const board = task ? await ctx.db.get(task.boardId) : null
    if (!task || !board || board.archivedAt || task.archivedAt || task.dueDate !== job.dueDate ||
      task.assigneeProjectMemberId !== job.recipientProjectMemberId || !member ||
      (member.status !== undefined && member.status !== 'active')) {
      await ctx.db.patch(job._id, { status: 'canceled', updatedAt: Date.now() })
      return false
    }
    const state = await ctx.db.get(task.workflowStateId)
    if (!state || isTerminalTaskState(state.category)) {
      await ctx.db.patch(job._id, { status: 'canceled', updatedAt: Date.now() })
      return false
    }
    await createTaskNotification(ctx, {
      task, recipient: member, eventType: job.kind,
      payload: { publicKey: task.publicKey, dueDate: task.dueDate },
      idempotencyKey: job.idempotencyKey,
    })
    await ctx.db.patch(job._id, { status: 'delivered', updatedAt: Date.now() })
    return true
  },
})
