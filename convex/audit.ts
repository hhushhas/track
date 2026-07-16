import { v } from 'convex/values'

import { query } from './_generated/server'
import { authorizeScopedRequest } from './lib/requestAuthorization'

export const listProjectEvents = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readProject')
    const visibleGroups = access.companyAccess
      ? access.companyAccess.entitlement?.channelIds ?? (await ctx.db
          .query('groupMembers')
          .withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', access.companyAccess!.projectMember._id).eq('status', 'active'),
          )
          .collect()).map((membership) => membership.groupId)
      : (await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect())
          .filter((membership) => membership.projectId === args.projectId)
          .map((membership) => membership.groupId)
    const visibleGroupIds = new Set(visibleGroups.map(String))
    const cutoff = access.companyAccess?.entitlement?.exitAt
    const events = await ctx.db
      .query('auditEvents')
      .withIndex('by_project_created_at', (q) => cutoff
        ? q.eq('projectId', args.projectId).lte('createdAt', cutoff)
        : q.eq('projectId', args.projectId))
      .order('desc')
      .take((args.limit ?? 100) * 2)
    return events
      .filter((event) => !event.groupId || visibleGroupIds.has(String(event.groupId)))
      .slice(0, args.limit ?? 100)
  },
})
