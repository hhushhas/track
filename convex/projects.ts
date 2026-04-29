import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { canRoleJoinDefaultGroup, requireProjectMember } from './lib/permissions'

const defaultGroups = [
  { kind: 'general', name: 'General' },
  { kind: 'internal', name: 'Internal' },
  { kind: 'commercials', name: 'Commercials' },
] as const

export const list = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const projects = await Promise.all(
      memberships.map(async (membership) => {
        const project = await ctx.db.get(membership.projectId)
        return project ? { project, membership } : null
      }),
    )

    return projects.filter((project) => project !== null)
  },
})

export const listMembers = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()

    return await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return { membership, user }
      }),
    )
  },
})

export const create = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    clientLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existingMembership = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    if (existingMembership) {
      const existingProject = await ctx.db.get(existingMembership.projectId)
      if (
        existingProject &&
        existingMembership.role !== 'owner' &&
        existingMembership.role !== 'admin'
      ) {
        throw new Error('not_allowed_to_create_project')
      }
    }

    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      clientLabel: args.clientLabel,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('projectMembers', {
      projectId,
      userId: args.userId,
      role: 'owner',
      canReviewAiRecords: true,
      createdAt: now,
      updatedAt: now,
    })

    for (const group of defaultGroups) {
      const groupId = await ctx.db.insert('groups', {
        projectId,
        kind: group.kind,
        name: group.name,
        aiReviewSettings: {
          enabled: true,
          frequencyMinutes: 30,
        },
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      })

      if (canRoleJoinDefaultGroup('owner', group.kind)) {
        await ctx.db.insert('groupMembers', {
          projectId,
          groupId,
          userId: args.userId,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    await appendAuditEvent(ctx, {
      projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      after: { name: args.name, clientLabel: args.clientLabel },
    })

    return projectId
  },
})

export const ensureStarter = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existingMembership = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    if (existingMembership) return existingMembership.projectId

    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      name: 'Default',
      clientLabel: 'Internal product build',
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('projectMembers', {
      projectId,
      userId: args.userId,
      role: 'owner',
      canReviewAiRecords: true,
      createdAt: now,
      updatedAt: now,
    })

    for (const group of defaultGroups) {
      const groupId = await ctx.db.insert('groups', {
        projectId,
        kind: group.kind,
        name: group.name,
        aiReviewSettings: {
          enabled: true,
          frequencyMinutes: 30,
        },
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      })

      await ctx.db.insert('groupMembers', {
        projectId,
        groupId,
        userId: args.userId,
        createdAt: now,
        updatedAt: now,
      })
    }

    await appendAuditEvent(ctx, {
      projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      after: { name: 'Default', clientLabel: 'Internal product build' },
    })

    return projectId
  },
})

export const getOverview = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    const project = await ctx.db.get(args.projectId)
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    const records = await ctx.db
      .query('records')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    const drafts = await ctx.db
      .query('draftRecords')
      .withIndex('by_project_status', (q) => q.eq('projectId', args.projectId))
      .collect()

    return {
      project,
      groups,
      metrics: {
        records: records.length,
        drafts: drafts.filter((draft) => draft.status === 'pending').length,
        billable: records.filter(
          (record) => record.classification === 'billable_scope',
        ).length,
        open: records.filter(
          (record) =>
            record.status === 'open' ||
            record.status === 'in_progress' ||
            record.status === 'blocked',
        ).length,
      },
    }
  },
})
