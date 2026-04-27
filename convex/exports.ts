import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireProjectMember } from './lib/permissions'

export const list = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    return await ctx.db
      .query('exports')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(50)
  },
})

export const request = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    format: v.union(v.literal('csv'), v.literal('pdf')),
    preset: v.union(v.literal('client_summary'), v.literal('full_audit_packet')),
    filters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    const exportId = await ctx.db.insert('exports', {
      projectId: args.projectId,
      requestedBy: args.userId,
      format: args.format,
      preset: args.preset,
      filters: args.filters ?? {},
      status: 'queued',
      createdAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.userId,
      entityType: 'export',
      entityId: exportId,
      action: 'export.requested',
      after: {
        format: args.format,
        preset: args.preset,
      },
    })

    return exportId
  },
})
