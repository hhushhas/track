import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendTaskActivity } from './lib/taskData'
import { requireTaskAccess, resolveTaskRequestContext } from './lib/taskPolicy'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

export const list = query({
  args: { projectId: v.id('projects'), includeArchived: v.optional(v.boolean()), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    const labels = await ctx.db.query('taskLabels')
      .withIndex('by_project_archived', (q) => q.eq('projectId', args.projectId)).collect()
    return args.includeArchived ? labels : labels.filter((label) => !label.archivedAt)
  },
})

export const create = mutation({
  args: { projectId: v.id('projects'), name: v.string(), colorToken: v.string(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (!access.capabilities.canManageProject) throw new Error('task_label_manage_forbidden')
    const name = args.name.trim()
    if (!name || name.length > 40) throw new Error('task_label_name_invalid')
    const existing = await ctx.db.query('taskLabels')
      .withIndex('by_project_name', (q) => q.eq('projectId', args.projectId).eq('name', name)).unique()
    if (existing && !existing.archivedAt) return existing._id
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { archivedAt: undefined, colorToken: args.colorToken, updatedAt: now })
      return existing._id
    }
    return await ctx.db.insert('taskLabels', {
      projectId: args.projectId, name, colorToken: args.colorToken,
      createdByProjectMemberId: access.projectMember._id, createdAt: now, updatedAt: now,
    })
  },
})

export const setArchived = mutation({
  args: { labelId: v.id('taskLabels'), archived: v.boolean(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const label = await ctx.db.get(args.labelId)
    if (!label) throw new Error('task_label_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, label.projectId, args)
    if (!access.capabilities.canManageProject) throw new Error('task_label_manage_forbidden')
    await ctx.db.patch(label._id, { archivedAt: args.archived ? Date.now() : undefined, updatedAt: Date.now() })
    return label._id
  },
})

export const setTaskLabels = mutation({
  args: { taskId: v.id('tasks'), labelIds: v.array(v.id('taskLabels')), expectedRevision: v.number(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canEdit) throw new Error('task_edit_forbidden')
    if (access.task.revision !== args.expectedRevision) throw new Error(`task_conflict:${access.task.revision}`)
    const labels = []
    for (const labelId of new Set(args.labelIds)) {
      const label = await ctx.db.get(labelId)
      if (!label || label.projectId !== access.task.projectId || label.archivedAt) throw new Error('task_label_invalid')
      labels.push(label)
    }
    const links = await ctx.db.query('taskLabelLinks').withIndex('by_task', (q) => q.eq('taskId', access.task._id)).collect()
    for (const link of links) await ctx.db.delete(link._id)
    const now = Date.now()
    for (const label of labels) await ctx.db.insert('taskLabelLinks', {
      projectId: access.task.projectId, taskId: access.task._id, labelId: label._id, createdAt: now,
    })
    await ctx.db.patch(access.task._id, { revision: access.task.revision + 1, updatedAt: now })
    await appendTaskActivity(ctx, {
      task: access.task, action: 'labels_changed', actorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      before: links.map((link) => link.labelId), after: labels.map((label) => label._id),
    })
    return access.task.revision + 1
  },
})
