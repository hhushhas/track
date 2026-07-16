import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { assertActorMatches, requireAuthenticatedActor } from './lib/actorContext'
import { authorizeScopedRequest } from './lib/requestAuthorization'
import { requireActiveCompanyMembership, requireCompanyModelEnabled } from './lib/companyPolicy'

const platform = v.union(v.literal('web'), v.literal('ios'), v.literal('android'))

async function getGroupUnreadCount(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  projectMemberId?: Id<'projectMembers'>,
  cutoff?: number,
) {
  const readState = projectMemberId
    ? await ctx.db.query('groupReadStates').withIndex('by_project_member_group', (q) =>
        q.eq('projectMemberId', projectMemberId).eq('groupId', groupId),
      ).unique()
    : await ctx.db.query('groupReadStates').withIndex('by_user_group', (q) =>
        q.eq('userId', userId).eq('groupId', groupId),
      ).unique()
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_group_created_at', (q) => q.eq('groupId', groupId))
    .collect()

  return messages.filter((message) => {
    if (cutoff && message.createdAt > cutoff) return false
    if (message.authorId === userId) return false
    if (!readState) return true
    return message.createdAt > readState.lastReadAt
  }).length
}

export const listProjects = query({
  args: {
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    if (args.actingCompanyId) {
      requireCompanyModelEnabled()
      await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId)
    }
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const rows = await Promise.all(
      memberships.filter((membership) => args.actingCompanyId
        ? membership.companyId === args.actingCompanyId && (membership.status === 'active' || membership.status === 'archived')
        : !membership.companyId,
      ).map(async (membership) => {
        const project = await ctx.db.get(membership.projectId)
        if (!project) return null
        const groupMemberships = membership.companyId
          ? membership.status === 'archived'
            ? []
            : await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
                q.eq('projectMemberId', membership._id).eq('status', 'active'),
              ).collect()
          : await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect()
        const entitlement = membership.status === 'archived'
          ? await ctx.db.query('projectArchiveEntitlements').withIndex('by_member', (q) => q.eq('projectMemberId', membership._id)).unique()
          : null
        const projectGroupMemberships = entitlement
          ? entitlement.channelIds.map((groupId) => ({ groupId }))
          : groupMemberships.filter((item) => item.projectId === project._id)
        const unreadCount = (
          await Promise.all(
            projectGroupMemberships.map((item) =>
              getGroupUnreadCount(ctx, item.groupId, args.userId, membership.companyId ? membership._id : undefined, entitlement?.exitAt),
            ),
          )
        ).reduce((total, count) => total + count, 0)

        return {
          project,
          membership,
          groupCount: projectGroupMemberships.length,
          unreadCount,
        }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

export const resolveNavigation = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    try {
      const access = await authorizeScopedRequest(ctx, {
        projectId: args.projectId,
        groupId: args.groupId,
        claimedUserId: args.userId,
        actingCompanyId: args.actingCompanyId,
        projectMemberId: args.projectMemberId,
      }, args.groupId ? 'readChannel' : 'readProject')
      return {
        available: true,
        archived: access.companyAccess?.projectMember.status === 'archived' || access.companyAccess?.project.status === 'archived',
      }
    } catch {
      return { available: false, archived: false }
    }
  },
})

export const listProjectMembers = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readProject')
    if (access.companyAccess?.entitlement) {
      return access.companyAccess.entitlement.memberSnapshots ?? []
    }
    const memberships = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect()
    const visible = access.companyAccess
      ? memberships.filter((membership) => membership.status === 'active')
      : memberships.filter((membership) => !membership.companyId)
    return await Promise.all(visible.map(async (membership) => {
      const [user, company] = await Promise.all([
        ctx.db.get(membership.userId),
        membership.companyId ? ctx.db.get(membership.companyId) : null,
      ])
      return {
        membership,
        user,
        company: company ? { _id: company._id, displayName: company.displayName } : null,
      }
    }))
  },
})

export const listGroups = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const access = await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readProject')
    const memberships = access.companyAccess
      ? access.companyAccess.projectMember.status === 'archived'
        ? []
        : await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', access.companyAccess!.projectMember._id).eq('status', 'active'),
          ).collect()
      : await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', args.userId)).collect()
    const visibleMemberships = access.companyAccess?.entitlement
      ? access.companyAccess.entitlement.channelIds.map((groupId) => ({ groupId, projectId: args.projectId, _id: groupId }))
      : memberships.filter((membership) => membership.projectId === args.projectId)

    const rows = await Promise.all(
      visibleMemberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId)
        if (!group) return null
        const cutoff = access.companyAccess?.entitlement?.exitAt
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_group_created_at', (q) => cutoff
            ? q.eq('groupId', group._id).lte('createdAt', cutoff)
            : q.eq('groupId', group._id))
          .order('desc')
          .first()
        const unreadCount = await getGroupUnreadCount(ctx, group._id, args.userId, args.projectMemberId, cutoff)
        const snapshot = access.companyAccess?.entitlement?.channelSnapshots.find((item: { _id?: string }) => item._id === group._id)
        return { group: snapshot ?? group, membership, lastMessage, unreadCount }
      }),
    )

    return rows.filter((row) => row !== null)
  },
})

export const getLastActiveContext = query({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const byDevice = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : null
    if (byDevice) return byDevice

    return await ctx.db
      .query('lastActiveContexts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .first()
  },
})

export const setLastActiveContext = mutation({
  args: {
    userId: v.id('users'),
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    deviceId: v.optional(v.string()),
    platform: v.optional(platform),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    if (args.projectId) await authorizeScopedRequest(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, args.groupId ? 'readChannel' : 'readProject')

    const now = Date.now()
    const existing = args.deviceId
      ? await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user_device', (q) =>
            q.eq('userId', args.userId).eq('deviceId', args.deviceId),
          )
          .unique()
      : await ctx.db
          .query('lastActiveContexts')
          .withIndex('by_user', (q) => q.eq('userId', args.userId))
          .first()

    const payload = {
      projectId: args.projectId,
      groupId: args.groupId,
      deviceId: args.deviceId,
      platform: args.platform,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }
    return await ctx.db.insert('lastActiveContexts', {
      userId: args.userId,
      ...payload,
    })
  },
})

export const markGroupRead = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
    lastReadMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group) throw new Error('group_not_found')
    const access = await authorizeScopedRequest(ctx, {
      projectId: group.projectId,
      groupId: group._id,
      claimedUserId: args.userId,
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    }, 'readChannel')
    if (access.companyAccess?.projectMember.status === 'archived') throw new Error('archive_read_state_immutable')
    if (args.lastReadMessageId) {
      const message = await ctx.db.get(args.lastReadMessageId)
      if (!message || message.groupId !== args.groupId) throw new Error('message_not_found')
    }

    const now = Date.now()
    const existing = args.projectMemberId
      ? await ctx.db.query('groupReadStates').withIndex('by_project_member_group', (q) =>
          q.eq('projectMemberId', args.projectMemberId).eq('groupId', args.groupId),
        ).unique()
      : await ctx.db.query('groupReadStates').withIndex('by_user_group', (q) =>
          q.eq('userId', args.userId).eq('groupId', args.groupId),
        ).unique()
    const payload = {
      projectId: group.projectId,
      groupId: args.groupId,
      userId: args.userId,
      projectMemberId: args.projectMemberId,
      lastReadMessageId: args.lastReadMessageId,
      lastReadAt: now,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert('groupReadStates', {
      ...payload,
      createdAt: now,
    })
  },
})
