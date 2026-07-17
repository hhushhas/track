import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { archivedTaskViews, taskView } from './lib/taskData'
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
    const projectAccess = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    const term = args.term.trim()
    if (!term) return []
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
    const normalizedTerm = term.toLowerCase()
    const exactKey = /^T-[23456789A-Z]{8}$/.test(term.toUpperCase())
      ? term.toUpperCase()
      : null
    if (projectAccess.capabilities.accessMode === 'archive' && projectAccess.entitlement) {
      return (await archivedTaskViews(ctx, projectAccess.entitlement._id))
        .filter(({ task }) => !task.archivedAt && (exactKey
          ? task.publicKey === exactKey
          : task.searchText.toLowerCase().includes(normalizedTerm)))
        .slice(0, limit)
    }
    const exact = exactKey
      ? await ctx.db.query('tasks').withIndex('by_project_key', (q) =>
          q.eq('projectId', args.projectId).eq('publicKey', exactKey),
        ).unique()
      : null
    const candidates = exact ? [exact] : await ctx.db.query('tasks')
      .withSearchIndex('search_tasks', (q) => q.search('searchText', term).eq('projectId', args.projectId))
      .take(Math.min(limit * 4, 100))
    const visible = []
    for (const task of candidates) {
      if (task.archivedAt) continue
      try {
        const access = await resolveTaskRequestContext(ctx, actor, task.projectId, args, task.groupId)
        if (task.groupId && !access.capabilities.canReadChannel) continue
        visible.push(await taskView(ctx, task))
        if (visible.length >= limit) break
      } catch {
        continue
      }
    }
    return visible
  },
})
