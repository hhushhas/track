import { taskSuggestionFingerprint } from '@track/shared/tasks'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { resolveTaskRequestContext } from './lib/taskPolicy'
import { taskPriority } from './schema/taskValidators'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

const candidateValidator = v.object({
  title: v.string(), description: v.optional(v.string()), priority: v.optional(taskPriority),
  assigneeProjectMemberId: v.optional(v.string()),
  dueDate: v.optional(v.string()), sourceMessageIds: v.array(v.string()),
  confidence: v.number(), groundingReason: v.string(),
})

export const getInput = query({
  args: { importId: v.id('memoryImports'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const memoryImport = await ctx.db.get(args.importId)
    if (!memoryImport || memoryImport.status !== 'completed' || !memoryImport.summary) {
      throw new Error('task_memory_import_unavailable')
    }
    const groupId = memoryImport.scope === 'project' ? undefined : memoryImport.groupId
    const access = await resolveTaskRequestContext(ctx, actor, memoryImport.projectId, args, groupId)
    if (!access.capabilities.canManageProject || (groupId && !access.capabilities.canReadChannel)) {
      throw new Error('task_memory_scan_forbidden')
    }
    return {
      groupId,
      message: {
        id: `memory:${memoryImport._id}`, author: 'Imported memory',
        body: memoryImport.summary.slice(0, 8_000), sequence: 1,
      },
      projectId: memoryImport.projectId,
    }
  },
})

export const commit = mutation({
  args: {
    importId: v.id('memoryImports'), model: v.string(),
    candidates: v.array(candidateValidator), ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const memoryImport = await ctx.db.get(args.importId)
    if (!memoryImport || memoryImport.status !== 'completed' || !memoryImport.summary) {
      throw new Error('task_memory_import_unavailable')
    }
    const groupId = memoryImport.scope === 'project' ? undefined : memoryImport.groupId
    const access = await resolveTaskRequestContext(ctx, actor, memoryImport.projectId, args, groupId)
    if (!access.capabilities.canManageProject || (groupId && !access.capabilities.canReadChannel)) {
      throw new Error('task_memory_scan_forbidden')
    }
    let created = 0
    for (const candidate of args.candidates) {
      if (candidate.confidence < 0.78 || candidate.sourceMessageIds.length !== 1 ||
        candidate.sourceMessageIds[0] !== `memory:${memoryImport._id}`) continue
      const fingerprint = taskSuggestionFingerprint({
        projectId: String(memoryImport.projectId), groupId: groupId ? String(groupId) : undefined,
        sourceIds: [String(memoryImport._id)], title: candidate.title, description: candidate.description,
      })
      const existing = await ctx.db.query('taskSuggestions').withIndex('by_project_fingerprint', (q) =>
        q.eq('projectId', memoryImport.projectId).eq('fingerprint', fingerprint),
      ).unique()
      if (existing) continue
      const tasks = await ctx.db.query('tasks')
        .withIndex('by_project_archived', (q) => q.eq('projectId', memoryImport.projectId).eq('archivedAt', undefined)).collect()
      const duplicate = tasks.find((task) => task.groupId === groupId && task.title.toLowerCase() === candidate.title.toLowerCase())
      const now = Date.now()
      const suggestionId = await ctx.db.insert('taskSuggestions', {
        projectId: memoryImport.projectId, groupId, proposedTitle: candidate.title,
        proposedDescription: candidate.description, proposedPriority: candidate.priority ?? 'none',
        proposedDueDate: candidate.dueDate, status: 'pending', confidence: candidate.confidence,
        groundingReason: candidate.groundingReason, fingerprint, possibleDuplicateTaskId: duplicate?._id,
        modelVersion: args.model, promptVersion: 'task-memory-extraction-v1', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('taskSuggestionReferences', {
        projectId: memoryImport.projectId, suggestionId, type: 'memory_excerpt', groupId,
        memoryImportId: memoryImport._id, sourceIdentifier: 'import-summary',
        quote: memoryImport.summary.slice(0, 280), availability: 'available', isPrimary: true,
        rank: '00000001', createdAt: now, updatedAt: now,
      })
      created += 1
    }
    return { created }
  },
})
