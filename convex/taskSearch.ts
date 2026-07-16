import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { taskView } from './lib/taskData'
import { requireTasksEnabled, resolveTaskRequestContext } from './lib/taskPolicy'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

export const search = query({
  args: { projectId: v.id('projects'), term: v.string(), limit: v.optional(v.number()), ...identityArgs },
  handler: async (ctx, args) => {
    requireTasksEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    const term = args.term.trim()
    if (!term) return []
    const exact = /^T-[23456789A-Z]{8}$/.test(term.toUpperCase())
      ? await ctx.db.query('tasks').withIndex('by_project_key', (q) =>
          q.eq('projectId', args.projectId).eq('publicKey', term.toUpperCase()),
        ).unique()
      : null
    const candidates = exact ? [exact] : await ctx.db.query('tasks')
      .withSearchIndex('search_tasks', (q) => q.search('searchText', term).eq('projectId', args.projectId))
      .take(Math.min(Math.max(args.limit ?? 20, 1) * 4, 100))
    const visible = []
    for (const task of candidates) {
      if (task.archivedAt) continue
      try {
        const access = await resolveTaskRequestContext(ctx, actor, task.projectId, args, task.groupId)
        if (task.groupId && !access.capabilities.canReadChannel) continue
        visible.push(await taskView(ctx, task))
        if (visible.length >= (args.limit ?? 20)) break
      } catch {
        continue
      }
    }
    return visible
  },
})
