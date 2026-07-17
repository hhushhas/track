import { resolveReleaseFeatureFlag } from '@track/shared/feature-flags'
import { taskSuggestionFingerprint } from '@track/shared/tasks'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import { threadsEnabled } from './lib/channelThreadPolicy'
import { requireEligibleTaskMember, requireTasksEnabled, resolveTaskRequestContext } from './lib/taskPolicy'
import { taskPriority } from './schema/taskValidators'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

const candidateValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  assigneeProjectMemberId: v.optional(v.string()),
  priority: v.optional(taskPriority),
  dueDate: v.optional(v.string()),
  sourceMessageIds: v.array(v.string()),
  confidence: v.number(),
  groundingReason: v.string(),
})

function visibleToTaskAutomation(message: Doc<'messages'>) {
  return !message.channelThreadId || threadsEnabled()
}

async function latestSequence(
  ctx: Pick<QueryCtx, 'db'>,
  groupId: Id<'groups'>,
) {
  const latest = (await ctx.db.query('messages')
    .withIndex('by_group_created_at', (q) => q.eq('groupId', groupId))
    .order('desc').collect()).find(visibleToTaskAutomation) ?? null
  return latest?.channelSequence ?? 0
}

export const getSetting = query({
  args: { projectId: v.id('projects'), groupId: v.id('groups'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
    if (!access.capabilities.canReadChannel) throw new Error('task_access_changed')
    const setting = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId)).unique()
    return setting ? { ...setting, canManage: access.capabilities.canManageProject } : {
      enabled: true,
      generation: 0,
      highWaterSequence: await latestSequence(ctx, args.groupId),
      lastRunStatus: undefined,
      lastErrorCategory: undefined,
      canManage: access.capabilities.canManageProject,
    }
  },
})

export const setEnabled = mutation({
  args: { projectId: v.id('projects'), groupId: v.id('groups'), enabled: v.boolean(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
    if (!access.capabilities.canManageProject || !access.capabilities.canReadChannel) {
      throw new Error('task_detection_manage_forbidden')
    }
    const existing = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId)).unique()
    const now = Date.now()
    const generation = (existing?.generation ?? 0) + 1
    if (existing?.scheduledJobId) await ctx.scheduler.cancel(existing.scheduledJobId)
    const patch = {
      enabled: args.enabled,
      generation,
      highWaterSequence: await latestSequence(ctx, args.groupId),
      scheduledJobId: undefined,
      lastRunStatus: args.enabled ? undefined : 'canceled' as const,
      lastErrorCategory: undefined,
      updatedByProjectMemberId: access.projectMember._id,
      updatedAt: now,
    }
    if (existing) await ctx.db.patch(existing._id, patch)
    else await ctx.db.insert('taskDetectionSettings', {
      projectId: args.projectId, groupId: args.groupId, ...patch, createdAt: now,
    })
    await appendAuditEvent(ctx, {
      projectId: args.projectId, groupId: args.groupId, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
      entityType: 'task_detection_setting', entityId: String(args.groupId),
      action: args.enabled ? 'enabled' : 'disabled',
    })
    return generation
  },
})

export const requestHistoryScan = mutation({
  args: {
    projectId: v.id('projects'), groupId: v.id('groups'),
    from: v.number(), to: v.number(), ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
    if (!access.capabilities.canManageProject || !access.capabilities.canReadChannel) {
      throw new Error('task_history_scan_forbidden')
    }
    if (!Number.isFinite(args.from) || !Number.isFinite(args.to) || args.from >= args.to ||
      args.to - args.from > 31 * 24 * 60 * 60 * 1_000) throw new Error('task_history_range_invalid')
    const messages = (await ctx.db.query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId)).collect())
      .filter((message) => visibleToTaskAutomation(message) && message.createdAt >= args.from && message.createdAt <= args.to && message.channelSequence)
      .sort((left, right) => left.channelSequence! - right.channelSequence!).slice(0, 120)
    if (!messages.length) return null
    let setting = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId)).unique()
    const now = Date.now()
    if (!setting) {
      const settingId = await ctx.db.insert('taskDetectionSettings', {
        projectId: args.projectId, groupId: args.groupId, enabled: true, generation: 1,
        highWaterSequence: await latestSequence(ctx, args.groupId),
        updatedByProjectMemberId: access.projectMember._id, createdAt: now, updatedAt: now,
      })
      setting = await ctx.db.get(settingId)
    }
    if (!setting) throw new Error('task_history_scan_failed')
    const leaseToken = crypto.randomUUID()
    const runId = await ctx.db.insert('taskDetectionRuns', {
      projectId: args.projectId, groupId: args.groupId, generation: setting.generation,
      mode: 'history', requestedByProjectMemberId: access.projectMember._id,
      startSequence: messages[0]!.channelSequence! - 1,
      endSequence: messages.at(-1)!.channelSequence!, status: 'running', leaseToken,
      leaseExpiresAt: now + 60_000, attempts: 1, correlationId: crypto.randomUUID(),
      createdAt: now, updatedAt: now,
    })
    await ctx.db.patch(setting._id, { lastRunStatus: 'running', lastErrorCategory: undefined, updatedAt: now })
    await ctx.scheduler.runAfter(0, (internal as any).taskDetectionNode.run, { runId, leaseToken })
    return runId
  },
})

export const queueForMessage = internalMutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args): Promise<Id<'_scheduled_functions'> | null> => {
    if (!resolveReleaseFeatureFlag(process.env.TRACK_TASKS_ENABLED)) return null
    const message = await ctx.db.get(args.messageId)
    if (!message?.channelSequence || !visibleToTaskAutomation(message)) return null
    const [project, group] = await Promise.all([ctx.db.get(message.projectId), ctx.db.get(message.groupId)])
    if (!project || !group || project.status === 'archived' || group.status === 'archived') return null
    let setting = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', message.groupId)).unique()
    const now = Date.now()
    if (!setting) {
      const settingId = await ctx.db.insert('taskDetectionSettings', {
        projectId: message.projectId, groupId: message.groupId, enabled: true, generation: 1,
        highWaterSequence: message.channelSequence - 1, createdAt: now, updatedAt: now,
      })
      setting = await ctx.db.get(settingId)
    }
    if (!setting?.enabled) return null
    if (setting.scheduledJobId) await ctx.scheduler.cancel(setting.scheduledJobId)
    const scheduledJobId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(1_500, (internal as any).taskDetection.startRun, {
      groupId: message.groupId, generation: setting.generation,
    })
    await ctx.db.patch(setting._id, { scheduledJobId, lastRunStatus: 'queued', updatedAt: now })
    return scheduledJobId
  },
})

export const startRun = internalMutation({
  args: { groupId: v.id('groups'), generation: v.number() },
  handler: async (ctx, args) => {
    requireTasksEnabled()
    const setting = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId)).unique()
    if (!setting?.enabled || setting.generation !== args.generation) return null
    const messages = await ctx.db.query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId)).collect()
    const pending = messages
      .filter((message) => visibleToTaskAutomation(message) && (message.channelSequence ?? 0) > setting.highWaterSequence)
      .sort((left, right) => (left.channelSequence ?? 0) - (right.channelSequence ?? 0))
      .slice(0, 24)
    if (!pending.length) {
      await ctx.db.patch(setting._id, { scheduledJobId: undefined, lastRunStatus: 'completed', updatedAt: Date.now() })
      return null
    }
    const endSequence = pending.at(-1)!.channelSequence!
    const leaseToken = crypto.randomUUID()
    const now = Date.now()
    const runId = await ctx.db.insert('taskDetectionRuns', {
      projectId: setting.projectId, groupId: setting.groupId, generation: setting.generation,
      mode: 'automatic',
      startSequence: setting.highWaterSequence, endSequence, status: 'running', leaseToken,
      leaseExpiresAt: now + 60_000, attempts: 1, correlationId: crypto.randomUUID(),
      createdAt: now, updatedAt: now,
    })
    await ctx.db.patch(setting._id, { scheduledJobId: undefined, lastRunStatus: 'running', updatedAt: now })
    await ctx.scheduler.runAfter(0, (internal as any).taskDetectionNode.run, { runId, leaseToken })
    return runId
  },
})

export const getRunInput = internalQuery({
  args: { runId: v.id('taskDetectionRuns'), leaseToken: v.string() },
  handler: async (ctx, args) => {
    if (!resolveReleaseFeatureFlag(process.env.TRACK_TASKS_ENABLED)) return null
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== 'running' || run.leaseToken !== args.leaseToken || run.leaseExpiresAt < Date.now()) return null
    const [setting, group, project] = await Promise.all([
      ctx.db.query('taskDetectionSettings').withIndex('by_group', (q) => q.eq('groupId', run.groupId)).unique(),
      ctx.db.get(run.groupId), ctx.db.get(run.projectId),
    ])
    const historyAuthorized = run.mode === 'history' && run.requestedByProjectMemberId
      ? await requireEligibleTaskMember(ctx, {
          projectId: run.projectId, groupId: run.groupId,
          projectMemberId: run.requestedByProjectMemberId,
        }).then(() => true, () => false)
      : false
    if ((run.mode === 'history' ? !historyAuthorized : !setting?.enabled || setting.generation !== run.generation ||
      setting.highWaterSequence !== run.startSequence) || !group || !project ||
      group.status === 'archived' || project.status === 'archived') return null
    const rows = await ctx.db.query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', run.groupId)).collect()
    const selected = rows.filter((message) => {
      const sequence = message.channelSequence ?? 0
      return visibleToTaskAutomation(message) && sequence > run.startSequence && sequence <= run.endSequence
    })
    const messages = []
    for (const message of selected) {
      const author = await ctx.db.get(message.authorId)
      messages.push({
        id: String(message._id), author: author?.displayName ?? 'Project member',
        body: message.body.slice(0, 2_000), sequence: message.channelSequence!,
        authorProjectMemberId: message.authorProjectMemberId ? String(message.authorProjectMemberId) : undefined,
      })
    }
    return { messages }
  },
})

export const commitRun = internalMutation({
  args: {
    runId: v.id('taskDetectionRuns'), leaseToken: v.string(), model: v.string(),
    candidates: v.array(candidateValidator),
  },
  handler: async (ctx, args) => {
    requireTasksEnabled()
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== 'running' || run.leaseToken !== args.leaseToken) return false
    const [setting, group, project] = await Promise.all([
      ctx.db.query('taskDetectionSettings')
        .withIndex('by_group', (q) => q.eq('groupId', run.groupId)).unique(),
      ctx.db.get(run.groupId),
      ctx.db.get(run.projectId),
    ])
    if (!setting) return null
    const historyAuthorized = run.mode === 'history' && run.requestedByProjectMemberId
      ? await requireEligibleTaskMember(ctx, {
          projectId: run.projectId,
          groupId: run.groupId,
          projectMemberId: run.requestedByProjectMemberId,
        }).then(() => true, () => false)
      : false
    const lifecycleValid = Boolean(group && project && group.projectId === run.projectId &&
      group.status !== 'archived' && project.status !== 'archived')
    const modeValid = run.mode === 'history'
      ? historyAuthorized
      : setting.enabled && setting.generation === run.generation &&
        setting.highWaterSequence === run.startSequence
    if (!lifecycleValid || !modeValid) {
      await ctx.db.patch(run._id, { status: 'canceled', updatedAt: Date.now() })
      return false
    }
    const windowMessages = await ctx.db.query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', run.groupId)).collect()
    const allowed = new Map(windowMessages.filter((message) => {
      const sequence = message.channelSequence ?? 0
      return visibleToTaskAutomation(message) && sequence > run.startSequence && sequence <= run.endSequence
    }).map((message) => [String(message._id), message]))
    let candidateCount = 0
    let lowConfidenceCount = 0
    for (const candidate of args.candidates) {
      if (candidate.confidence < 0.78) {
        lowConfidenceCount += 1
        continue
      }
      const sources = candidate.sourceMessageIds.map((id) => allowed.get(id))
      if (sources.some((source) => !source)) continue
      const proposedAssigneeId = candidate.assigneeProjectMemberId
        ? ctx.db.normalizeId('projectMembers', candidate.assigneeProjectMemberId) : null
      const proposedAssignee = proposedAssigneeId && sources.some((source) => source?.authorProjectMemberId === proposedAssigneeId)
        ? await requireEligibleTaskMember(ctx, {
            projectId: run.projectId, groupId: run.groupId, projectMemberId: proposedAssigneeId,
          }).catch(() => null)
        : null
      const fingerprint = taskSuggestionFingerprint({
        projectId: String(run.projectId), groupId: String(run.groupId),
        sourceIds: candidate.sourceMessageIds, title: candidate.title, description: candidate.description,
      })
      const existing = await ctx.db.query('taskSuggestions')
        .withIndex('by_project_fingerprint', (q) => q.eq('projectId', run.projectId).eq('fingerprint', fingerprint))
        .unique()
      if (existing) continue
      const openTasks = await ctx.db.query('tasks')
        .withIndex('by_project_archived', (q) => q.eq('projectId', run.projectId).eq('archivedAt', undefined))
        .collect()
      const duplicate = openTasks.find((task) =>
        (task.groupId === undefined || task.groupId === run.groupId) &&
        task.title.trim().toLowerCase() === candidate.title.trim().toLowerCase(),
      )
      const now = Date.now()
      const suggestionId = await ctx.db.insert('taskSuggestions', {
        projectId: run.projectId, groupId: run.groupId,
        proposedTitle: candidate.title, proposedDescription: candidate.description,
        proposedPriority: candidate.priority ?? 'none', proposedDueDate: candidate.dueDate,
        proposedAssigneeProjectMemberId: proposedAssignee?._id,
        status: 'pending', confidence: candidate.confidence,
        groundingReason: candidate.groundingReason, fingerprint,
        possibleDuplicateTaskId: duplicate?._id,
        modelVersion: args.model, promptVersion: 'task-detection-v1',
        createdAt: now, updatedAt: now,
      })
      for (const [index, source] of sources.entries()) {
        await ctx.db.insert('taskSuggestionReferences', {
          projectId: run.projectId, suggestionId, type: 'message', groupId: run.groupId,
          channelThreadId: source!.channelThreadId, messageId: source!._id,
          quote: source!.body.slice(0, 280), availability: 'available',
          isPrimary: index === 0, rank: String(index + 1).padStart(8, '0'),
          createdAt: now, updatedAt: now,
        })
      }
      candidateCount += 1
    }
    const now = Date.now()
    await ctx.db.patch(run._id, { status: 'completed', candidateCount, lowConfidenceCount, updatedAt: now })
    if (run.mode === 'history') await ctx.db.patch(setting._id, {
      lastRunStatus: 'completed', lastErrorCategory: undefined, updatedAt: now,
    })
    else {
      const morePending = windowMessages.some((message) =>
        visibleToTaskAutomation(message) && (message.channelSequence ?? 0) > run.endSequence,
      )
      const scheduledJobId = morePending
        ? await ctx.scheduler.runAfter(0, (internal as any).taskDetection.startRun, {
            groupId: run.groupId,
            generation: run.generation,
          })
        : undefined
      await ctx.db.patch(setting._id, {
        highWaterSequence: run.endSequence,
        scheduledJobId,
        lastRunStatus: morePending ? 'queued' : 'completed',
        lastErrorCategory: undefined,
        updatedAt: now,
      })
    }
    return true
  },
})

export const failRun = internalMutation({
  args: { runId: v.id('taskDetectionRuns'), leaseToken: v.string(), errorCategory: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== 'running' || run.leaseToken !== args.leaseToken) return false
    const setting = await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', run.groupId)).unique()
    if (!setting) return false
    const now = Date.now()
    const retryable = run.mode === 'history' || Boolean(setting?.enabled && setting.generation === run.generation &&
      setting.highWaterSequence === run.startSequence)
    if (run.attempts < 3 && retryable) {
      await ctx.db.patch(run._id, { attempts: run.attempts + 1, leaseExpiresAt: now + 60_000, updatedAt: now })
      await ctx.scheduler.runAfter(2 ** run.attempts * 1_000, (internal as any).taskDetectionNode.run, {
        runId: run._id, leaseToken: run.leaseToken,
      })
      return true
    }
    await ctx.db.patch(run._id, { status: 'failed', errorCategory: args.errorCategory, updatedAt: now })
    if (setting) await ctx.db.patch(setting._id, {
      lastRunStatus: 'failed', lastErrorCategory: args.errorCategory, updatedAt: now,
    })
    return false
  },
})
