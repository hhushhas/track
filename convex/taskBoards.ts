import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import { resolveTaskRequestContext } from './lib/taskPolicy'
import { taskStateCategory } from './schema/taskValidators'
import { rescheduleTaskReminders } from './taskReminders'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

const standardWorkflow = [
  { name: 'Backlog', category: 'backlog', token: 'neutral' },
  { name: 'To do', category: 'unstarted', token: 'blue' },
  { name: 'In progress', category: 'started', token: 'amber' },
  { name: 'Done', category: 'completed', token: 'green' },
  { name: 'Canceled', category: 'canceled', token: 'neutral' },
] as const

function validBoardName(value: string) {
  const name = value.trim()
  if (!name || name.length > 80) throw new Error('task_board_name_invalid')
  return name
}

function requireBoardManagement(
  capabilities: { canManageProject: boolean; canReadChannel: boolean },
  groupId?: Id<'groups'>,
) {
  if (!capabilities.canManageProject || (groupId && !capabilities.canReadChannel)) {
    throw new Error('task_board_manage_forbidden')
  }
}

async function activeBoardsForScope(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  groupId?: Id<'groups'>,
) {
  return await ctx.db
    .query('taskBoards')
    .withIndex('by_scope_archived', (q) =>
      q.eq('projectId', projectId).eq('groupId', groupId).eq('archivedAt', undefined),
    )
    .collect()
}

async function insertStandardWorkflow(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  boardId: Id<'taskBoards'>,
  now: number,
) {
  for (const [index, state] of standardWorkflow.entries()) {
    await ctx.db.insert('taskWorkflowStates', {
      projectId,
      boardId,
      name: state.name,
      category: state.category,
      visualToken: state.token,
      rank: String(index + 1).padStart(4, '0'),
      isDefault: state.category === 'unstarted',
      createdAt: now,
      updatedAt: now,
    })
  }
}

async function rescheduleBoardTaskReminders(ctx: MutationCtx, boardId: Id<'taskBoards'>) {
  const tasks = await ctx.db.query('tasks').withIndex('by_board', (q) => q.eq('boardId', boardId)).collect()
  for (const task of tasks) await rescheduleTaskReminders(ctx, task)
}

export async function getOrCreateDefaultBoard(
  ctx: MutationCtx,
  input: {
    projectId: Id<'projects'>
    groupId?: Id<'groups'>
    projectMemberId: Id<'projectMembers'>
    actingCompanyId?: Id<'companies'>
    channelName?: string
  },
) {
  const active = await activeBoardsForScope(ctx, input.projectId, input.groupId)
  const existing = active.find((board) => board.isDefault) ?? active[0]
  if (existing) return existing

  const now = Date.now()
  const boardId = await ctx.db.insert('taskBoards', {
    projectId: input.projectId,
    groupId: input.groupId,
    name: input.groupId ? `${input.channelName ?? 'Channel'} tasks` : 'Project tasks',
    rank: String(active.length + 1).padStart(8, '0'),
    isDefault: true,
    createdByProjectMemberId: input.projectMemberId,
    actingCompanyId: input.actingCompanyId,
    createdAt: now,
    updatedAt: now,
  })
  await insertStandardWorkflow(ctx, input.projectId, boardId, now)
  const board = await ctx.db.get(boardId)
  if (!board) throw new Error('task_destination_invalid')
  return board
}

export const list = query({
  args: { projectId: v.id('projects'), includeArchived: v.optional(v.boolean()), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const projectAccess = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (projectAccess.capabilities.accessMode === 'archive' && projectAccess.entitlement) {
      const [boardRows, stateRows] = await Promise.all([
        ctx.db.query('taskArchiveSnapshots').withIndex('by_entitlement_table', (q) =>
          q.eq('entitlementId', projectAccess.entitlement!._id).eq('sourceTable', 'taskBoards'),
        ).collect(),
        ctx.db.query('taskArchiveSnapshots').withIndex('by_entitlement_table', (q) =>
          q.eq('entitlementId', projectAccess.entitlement!._id).eq('sourceTable', 'taskWorkflowStates'),
        ).collect(),
      ])
      const states = stateRows.map((row) => row.payload as Doc<'taskWorkflowStates'>)
      return boardRows.map((row) => row.payload as Doc<'taskBoards'>)
        .filter((board) => args.includeArchived || !board.archivedAt)
        .map((board) => ({
          board,
          states: states.filter((state) => state.boardId === board._id && !state.archivedAt),
        }))
    }
    const boards = await ctx.db
      .query('taskBoards')
      .withIndex('by_project_archived', (q) => q.eq('projectId', args.projectId))
      .collect()
    const visible: Array<{ board: Doc<'taskBoards'>; states: Array<Doc<'taskWorkflowStates'>> }> = []
    for (const board of boards) {
      if (board.archivedAt && !args.includeArchived) continue
      try {
        const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, board.groupId)
        if (board.groupId && !access.capabilities.canReadChannel) continue
        const states = await ctx.db
          .query('taskWorkflowStates')
          .withIndex('by_board_rank', (q) => q.eq('boardId', board._id))
          .collect()
        visible.push({ board, states: states.filter((state) => !state.archivedAt) })
      } catch {
        continue
      }
    }
    return visible.sort((left, right) =>
      (left.board.rank ?? left.board.createdAt.toString()).localeCompare(
        right.board.rank ?? right.board.createdAt.toString(),
      ),
    )
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    name: v.string(),
    description: v.optional(v.string()),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
    if (!access.capabilities.canManageProject || (args.groupId && !access.capabilities.canReadChannel)) {
      throw new Error('task_board_manage_forbidden')
    }
    const active = await activeBoardsForScope(ctx, args.projectId, args.groupId)
    const now = Date.now()
    const boardId = await ctx.db.insert('taskBoards', {
      projectId: args.projectId,
      groupId: args.groupId,
      name: validBoardName(args.name),
      description: args.description?.trim() || undefined,
      rank: String(active.length + 1).padStart(8, '0'),
      isDefault: active.length === 0,
      createdByProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      createdAt: now,
      updatedAt: now,
    })
    await insertStandardWorkflow(ctx, args.projectId, boardId, now)
    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      entityType: 'task_board',
      entityId: String(boardId),
      action: 'created',
    })
    return boardId
  },
})

export const update = mutation({
  args: {
    boardId: v.id('taskBoards'),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    await ctx.db.patch(board._id, {
      name: validBoardName(args.name),
      description: args.description?.trim() || undefined,
      updatedAt: Date.now(),
    })
    return board._id
  },
})

export const reorder = mutation({
  args: { boardId: v.id('taskBoards'), targetIndex: v.number(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    const boards = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    boards.sort((left, right) => (left.rank ?? String(left.createdAt)).localeCompare(right.rank ?? String(right.createdAt)))
    const without = boards.filter((candidate) => candidate._id !== board._id)
    without.splice(Math.max(0, Math.min(Math.trunc(args.targetIndex), without.length)), 0, board)
    const now = Date.now()
    for (const [index, candidate] of without.entries()) {
      await ctx.db.patch(candidate._id, { rank: String(index + 1).padStart(8, '0'), updatedAt: now })
    }
    return board._id
  },
})

export const configureWorkflow = mutation({
  args: {
    boardId: v.id('taskBoards'),
    defaultIndex: v.number(),
    replacementStateId: v.optional(v.id('taskWorkflowStates')),
    states: v.array(v.object({
      stateId: v.optional(v.id('taskWorkflowStates')),
      name: v.string(),
      category: taskStateCategory,
      visualToken: v.string(),
    })),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board || board.archivedAt) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    if (args.states.length < 2 || args.defaultIndex < 0 || args.defaultIndex >= args.states.length) {
      throw new Error('task_workflow_invalid')
    }
    if (!args.states.some((state) => state.category === 'completed') ||
      args.states[args.defaultIndex]!.category === 'completed' || args.states[args.defaultIndex]!.category === 'canceled') {
      throw new Error('task_workflow_invalid')
    }
    const names = args.states.map((state) => validBoardName(state.name).toLowerCase())
    if (new Set(names).size !== names.length) throw new Error('task_workflow_invalid')
    const existing = await ctx.db.query('taskWorkflowStates')
      .withIndex('by_board_rank', (q) => q.eq('boardId', board._id)).collect()
    const existingIds = new Set(existing.map((state) => String(state._id)))
    for (const state of args.states) {
      if (state.stateId && !existingIds.has(String(state.stateId))) throw new Error('task_workflow_invalid')
    }
    const now = Date.now()
    const retainedIds = new Set(args.states.flatMap((state) => state.stateId ? [String(state.stateId)] : []))
    const resolved = []
    for (const [index, state] of args.states.entries()) {
      const values = {
        name: validBoardName(state.name), category: state.category, visualToken: state.visualToken.trim() || 'neutral',
        rank: String(index + 1).padStart(4, '0'), isDefault: index === args.defaultIndex,
        archivedAt: undefined, updatedAt: now,
      }
      if (state.stateId) {
        const previous = existing.find((candidate) => candidate._id === state.stateId)!
        await ctx.db.patch(state.stateId, values)
        resolved.push(state.stateId)
        if (previous.category !== state.category) {
          const affected = await ctx.db.query('tasks')
            .withIndex('by_board_state_rank', (q) =>
              q.eq('boardId', board._id).eq('workflowStateId', state.stateId!),
            )
            .collect()
          for (const task of affected) {
            const terminalAt = state.category === 'completed' || state.category === 'canceled'
              ? task.terminalAt ?? now
              : undefined
            const updatedTask = {
              ...task,
              terminalAt,
              revision: task.revision + 1,
              updatedAt: now,
            }
            await ctx.db.patch(task._id, {
              terminalAt,
              revision: updatedTask.revision,
              updatedAt: now,
            })
            await rescheduleTaskReminders(ctx, updatedTask)
          }
        }
      } else {
        resolved.push(await ctx.db.insert('taskWorkflowStates', {
          projectId: board.projectId, boardId: board._id, ...values, createdAt: now,
        }))
      }
    }
    const destinationId = args.replacementStateId && retainedIds.has(String(args.replacementStateId))
      ? args.replacementStateId
      : resolved[args.defaultIndex]!
    const destinationState = await ctx.db.get(destinationId)
    if (!destinationState || destinationState.boardId !== board._id || destinationState.archivedAt) {
      throw new Error('task_workflow_invalid')
    }
    for (const removed of existing.filter((state) => !retainedIds.has(String(state._id)))) {
      const affected = await ctx.db.query('tasks')
        .withIndex('by_board_state_rank', (q) => q.eq('boardId', board._id).eq('workflowStateId', removed._id))
        .collect()
      if (affected.length && !args.replacementStateId) throw new Error('task_workflow_replacement_required')
      for (const task of affected) {
        const terminalAt = destinationState.category === 'completed' || destinationState.category === 'canceled'
          ? task.terminalAt ?? now
          : undefined
        const updatedTask = {
          ...task,
          workflowStateId: destinationId,
          terminalAt,
          revision: task.revision + 1,
          updatedAt: now,
        }
        await ctx.db.patch(task._id, {
          workflowStateId: destinationId,
          terminalAt,
          revision: updatedTask.revision,
          updatedAt: now,
        })
        await rescheduleTaskReminders(ctx, updatedTask)
        await ctx.db.insert('taskActivities', {
          projectId: task.projectId, taskId: task._id, originalGroupId: task.groupId,
          actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
          action: 'state_changed', before: removed._id, after: destinationId,
          correlationId: `workflow:${board._id}:${now}`, createdAt: now,
        })
      }
      await ctx.db.patch(removed._id, { archivedAt: now, isDefault: false, updatedAt: now })
    }
    await appendAuditEvent(ctx, {
      projectId: board.projectId, groupId: board.groupId, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
      entityType: 'task_board', entityId: String(board._id), action: 'workflow_configured',
    })
    return board._id
  },
})

export const setDefault = mutation({
  args: { boardId: v.id('taskBoards'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board || board.archivedAt) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    const active = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    const now = Date.now()
    await Promise.all(active.map((candidate) =>
      ctx.db.patch(candidate._id, { isDefault: candidate._id === board._id, updatedAt: now }),
    ))
    return board._id
  },
})

export const archive = mutation({
  args: { boardId: v.id('taskBoards'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    if (board.archivedAt) return board._id
    const active = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    const replacement = active.find((candidate) => candidate._id !== board._id)
    const now = Date.now()
    await ctx.db.patch(board._id, { archivedAt: now, isDefault: false, updatedAt: now })
    await rescheduleBoardTaskReminders(ctx, board._id)
    if (board.isDefault && replacement) {
      await ctx.db.patch(replacement._id, { isDefault: true, updatedAt: now })
    }
    await appendAuditEvent(ctx, {
      projectId: board.projectId,
      groupId: board.groupId,
      actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      entityType: 'task_board', entityId: String(board._id), action: 'archived',
    })
    return board._id
  },
})

export const restore = mutation({
  args: { boardId: v.id('taskBoards'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    const active = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    const now = Date.now()
    await ctx.db.patch(board._id, { archivedAt: undefined, isDefault: active.length === 0, updatedAt: now })
    await rescheduleBoardTaskReminders(ctx, board._id)
    return board._id
  },
})

export const addWorkflowState = mutation({
  args: {
    boardId: v.id('taskBoards'), name: v.string(), category: taskStateCategory,
    visualToken: v.string(), ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board || board.archivedAt) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    const states = await ctx.db.query('taskWorkflowStates')
      .withIndex('by_board_rank', (q) => q.eq('boardId', board._id)).collect()
    const now = Date.now()
    return await ctx.db.insert('taskWorkflowStates', {
      projectId: board.projectId, boardId: board._id, name: validBoardName(args.name),
      category: args.category, visualToken: args.visualToken, rank: String(states.length + 1).padStart(4, '0'),
      isDefault: false, createdAt: now, updatedAt: now,
    })
  },
})

export const removeWorkflowState = mutation({
  args: {
    stateId: v.id('taskWorkflowStates'), replacementStateId: v.optional(v.id('taskWorkflowStates')),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const state = await ctx.db.get(args.stateId)
    if (!state) throw new Error('task_destination_invalid')
    const board = await ctx.db.get(state.boardId)
    if (!board) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    requireBoardManagement(access.capabilities, board.groupId)
    const tasks = await ctx.db.query('tasks')
      .withIndex('by_board_state_rank', (q) => q.eq('boardId', board._id).eq('workflowStateId', state._id))
      .collect()
    const replacement = args.replacementStateId ? await ctx.db.get(args.replacementStateId) : null
    if (tasks.length && (!replacement || replacement.boardId !== board._id || replacement.archivedAt)) {
      throw new Error('task_replacement_state_required')
    }
    if (state.isDefault) throw new Error('task_default_state_required')
    if (state.category === 'completed') {
      const states = await ctx.db.query('taskWorkflowStates')
        .withIndex('by_board_rank', (q) => q.eq('boardId', board._id)).collect()
      if (!states.some((candidate) => candidate._id !== state._id && !candidate.archivedAt && candidate.category === 'completed')) {
        throw new Error('task_completed_state_required')
      }
    }
    const now = Date.now()
    for (const task of tasks) {
      const updatedTask = {
        ...task,
        workflowStateId: replacement!._id,
        terminalAt: replacement && (replacement.category === 'completed' || replacement.category === 'canceled')
          ? task.terminalAt ?? now : undefined,
        revision: task.revision + 1, updatedAt: now,
      }
      await ctx.db.patch(task._id, {
        workflowStateId: updatedTask.workflowStateId,
        terminalAt: updatedTask.terminalAt,
        revision: updatedTask.revision,
        updatedAt: updatedTask.updatedAt,
      })
      await rescheduleTaskReminders(ctx, updatedTask)
    }
    await ctx.db.patch(state._id, { archivedAt: now, updatedAt: now })
    return state._id
  },
})
