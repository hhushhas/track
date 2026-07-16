import { v } from 'convex/values'

import { internalMutation, internalQuery, query } from './_generated/server'
import { requireGroupMember, requireProjectMember } from './lib/permissions'
import { initialContextTemplate, type BoxAccessScope } from './lib/memoryPolicy'

const memorySchemaVersion = 1

export const getStatus = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    return await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
  },
})

export const listImports = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    return await ctx.db
      .query('memoryImports')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(args.limit ?? 20)
  },
})

export const getAccessScope = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    actorId: v.id('users'),
    boxId: v.string(),
    runId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BoxAccessScope> => {
    const member = await requireProjectMember(ctx, args.projectId, args.actorId)
    await requireGroupMember(ctx, args.groupId, args.actorId)
    const canAccessAllGroups = member.role === 'owner' || member.role === 'admin'
    const allowedGroupIds = canAccessAllGroups
      ? (await ctx.db
          .query('groups')
          .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
          .collect()).map((group) => group._id)
      : (await ctx.db
          .query('groupMembers')
          .withIndex('by_user', (q) => q.eq('userId', args.actorId))
          .collect())
          .filter((membership) =>
            membership.projectId === args.projectId &&
            (!membership.status || membership.status === 'active'))
          .map((membership) => membership.groupId)
    return {
      actorUserId: args.actorId,
      allowedGroupIds,
      boxId: args.boxId,
      canAccessAllGroups,
      projectId: args.projectId,
      role: member.role,
      runId: args.runId,
    }
  },
})

export const getMemoryBoxForProject = query({
  args: {
    projectId: v.id('projects'),
    actorId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.actorId)
    return await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
  },
})

export const listMemoryBoxesForCleanup = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('projectMemoryBoxes')
      .collect()
  },
})

export const authorizeGroupMemoryWrite = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    actorId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId)
    if (!group || group.projectId !== args.projectId) throw new Error('group_project_mismatch')
    await requireGroupMember(ctx, args.groupId, args.actorId)
  },
})

export const createImportJob = internalMutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    actorId: v.id('users'),
    sourceKind: v.union(v.literal('paste'), v.literal('file'), v.literal('link'), v.literal('chat_export'), v.literal('track_attachment')),
    sourceStorageIds: v.array(v.id('_storage')),
    sourceUrls: v.array(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const importId = await ctx.db.insert('memoryImports', {
      ...args,
      status: 'queued',
      updatedAt: args.createdAt,
    })
    await ctx.db.insert('auditEvents', {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.actorId,
      entityType: 'memoryImport',
      entityId: importId,
      action: 'memory_import.queued',
      after: { sourceKind: args.sourceKind, sourceUrlCount: args.sourceUrls.length, sourceStorageCount: args.sourceStorageIds.length },
      createdAt: Date.now(),
    })
    return importId
  },
})

export const updateImportJob = internalMutation({
  args: {
    importId: v.id('memoryImports'),
    status: v.optional(v.union(v.literal('queued'), v.literal('running'), v.literal('completed'), v.literal('failed'))),
    boxScratchPath: v.optional(v.string()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.importId, {
      boxScratchPath: args.boxScratchPath,
      completedAt: args.completedAt,
      error: args.error,
      status: args.status,
      summary: args.summary,
      updatedAt: args.updatedAt,
    })
  },
})

export const createMemoryBoxRecord = internalMutation({
  args: {
    projectId: v.id('projects'),
    boxId: v.string(),
    runtime: v.string(),
    createdBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        boxId: args.boxId,
        contextLength: initialContextTemplate.length,
        error: undefined,
        lastUsedAt: now,
        runtime: args.runtime,
        schemaVersion: memorySchemaVersion,
        status: 'ready',
        updatedAt: now,
      })
      await ctx.db.insert('auditEvents', {
        projectId: args.projectId,
        actorId: args.createdBy,
        entityType: 'projectMemoryBox',
        entityId: args.boxId,
        action: 'memory_box.created',
        after: { rowId: existing._id, runtime: args.runtime, reusedRow: true },
        createdAt: now,
      })
      return await ctx.db.get(existing._id)
    }
    const id = await ctx.db.insert('projectMemoryBoxes', {
      boxId: args.boxId,
      createdAt: now,
      createdBy: args.createdBy,
      projectId: args.projectId,
      runtime: args.runtime,
      schemaVersion: memorySchemaVersion,
      status: 'ready',
      updatedAt: now,
      lastUsedAt: now,
      contextLength: initialContextTemplate.length,
    })
    await ctx.db.insert('auditEvents', {
      projectId: args.projectId,
      actorId: args.createdBy,
      entityType: 'projectMemoryBox',
      entityId: args.boxId,
      action: 'memory_box.created',
      after: { rowId: id, runtime: args.runtime },
      createdAt: now,
    })
    return await ctx.db.get(id)
  },
})

export const markMemoryBoxUsed = internalMutation({
  args: {
    projectId: v.id('projects'),
    boxId: v.string(),
    actorId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
    if (!row) throw new Error('memory_box_not_found')
    await ctx.db.patch(row._id, { lastUsedAt: Date.now(), status: row.status === 'paused' ? 'ready' : row.status, updatedAt: Date.now() })
    await ctx.db.insert('auditEvents', {
      projectId: args.projectId,
      actorId: args.actorId,
      entityType: 'projectMemoryBox',
      entityId: args.boxId,
      action: 'memory_box.reused',
      after: { status: row.status },
      createdAt: Date.now(),
    })
  },
})

export const updateMemoryBoxContextStats = internalMutation({
  args: {
    projectId: v.id('projects'),
    boxId: v.string(),
    contextLength: v.number(),
    lastContextUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
    if (!row) throw new Error('memory_box_not_found')
    await ctx.db.patch(row._id, {
      contextLength: args.contextLength,
      lastContextUpdatedAt: args.lastContextUpdatedAt,
      lastUsedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const markMemoryBoxDeleted = internalMutation({
  args: {
    projectId: v.id('projects'),
    boxId: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('projectMemoryBoxes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique()
    if (!row || row.boxId !== args.boxId) return
    await ctx.db.patch(row._id, {
      error: args.error,
      status: args.error ? 'error' : 'deleted',
      updatedAt: Date.now(),
    })
  },
})

export const auditMemoryEvent = internalMutation({
  args: {
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    actorId: v.optional(v.id('users')),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditEvents', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const acquireMemoryPathLock = internalMutation({
  args: {
    projectId: v.id('projects'),
    path: v.string(),
    holderId: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('memoryPathLocks')
      .withIndex('by_project_path', (q) => q.eq('projectId', args.projectId).eq('path', args.path))
      .unique()
    const now = Date.now()
    if (existing && existing.expiresAt > now) throw new Error('memory_path_locked')
    if (existing) {
      await ctx.db.patch(existing._id, {
        expiresAt: args.expiresAt,
        holderId: args.holderId,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert('memoryPathLocks', {
      createdAt: now,
      expiresAt: args.expiresAt,
      holderId: args.holderId,
      path: args.path,
      projectId: args.projectId,
      updatedAt: now,
    })
  },
})

export const releaseMemoryPathLock = internalMutation({
  args: {
    lockId: v.id('memoryPathLocks'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.lockId).catch(() => undefined)
  },
})
