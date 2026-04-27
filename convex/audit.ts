import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireProjectMember } from './lib/permissions'

export const listProjectEvents = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    return await ctx.db
      .query('auditEvents')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})
