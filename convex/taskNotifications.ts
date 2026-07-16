import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { requireTaskAccess, resolveTaskRequestContext } from './lib/taskPolicy'
import { taskNotificationMode } from './schema/taskValidators'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

export const list = query({
  args: { projectId: v.id('projects'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (access.capabilities.accessMode !== 'active') return []
    const rows = await ctx.db.query('taskNotifications')
      .withIndex('by_member_created_at', (q) => q.eq('recipientProjectMemberId', access.projectMember._id))
      .order('desc').take(100)
    const visible = []
    for (const row of rows) {
      try {
        await requireTaskAccess(ctx, actor, row.taskId, args)
        visible.push(row)
      } catch {
        continue
      }
    }
    return visible
  },
})

export const markRead = mutation({
  args: { notificationId: v.id('taskNotifications'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const row = await ctx.db.get(args.notificationId)
    if (!row) throw new Error('task_access_changed')
    const access = await requireTaskAccess(ctx, actor, row.taskId, args)
    if (row.recipientProjectMemberId !== access.projectMember._id) throw new Error('task_access_changed')
    await ctx.db.patch(row._id, { readAt: row.readAt ?? Date.now() })
    return row._id
  },
})

export const markAllRead = mutation({
  args: { projectId: v.id('projects'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (access.capabilities.accessMode !== 'active') throw new Error('task_access_changed')
    const rows = await ctx.db.query('taskNotifications')
      .withIndex('by_member_read', (q) => q.eq('recipientProjectMemberId', access.projectMember._id).eq('readAt', undefined))
      .collect()
    let updated = 0
    for (const row of rows) {
      try {
        await requireTaskAccess(ctx, actor, row.taskId, args)
        await ctx.db.patch(row._id, { readAt: Date.now() })
        updated += 1
      } catch {
        continue
      }
    }
    return updated
  },
})

export const setPreference = mutation({
  args: { projectId: v.id('projects'), mode: taskNotificationMode, ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (access.capabilities.accessMode !== 'active') throw new Error('task_access_changed')
    const existing = await ctx.db.query('taskNotificationSettings')
      .withIndex('by_member', (q) => q.eq('projectMemberId', access.projectMember._id)).unique()
    const now = Date.now()
    if (existing) await ctx.db.patch(existing._id, { mode: args.mode, updatedAt: now })
    else await ctx.db.insert('taskNotificationSettings', {
      projectId: args.projectId, projectMemberId: access.projectMember._id,
      mode: args.mode, createdAt: now, updatedAt: now,
    })
    return args.mode
  },
})
