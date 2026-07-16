import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import { resolveTaskRequestContext, type TaskRequestIdentity } from './lib/taskPolicy'
import { taskStateCategory } from './schema/taskValidators'

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
    return visible
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

export const setDefault = mutation({
  args: { boardId: v.id('taskBoards'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const board = await ctx.db.get(args.boardId)
    if (!board || board.archivedAt) throw new Error('task_destination_invalid')
    const access = await resolveTaskRequestContext(ctx, actor, board.projectId, args, board.groupId)
    if (!access.capabilities.canManageProject) throw new Error('task_board_manage_forbidden')
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
    if (!access.capabilities.canManageProject) throw new Error('task_board_manage_forbidden')
    if (board.archivedAt) return board._id
    const active = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    const replacement = active.find((candidate) => candidate._id !== board._id)
    const now = Date.now()
    await ctx.db.patch(board._id, { archivedAt: now, isDefault: false, updatedAt: now })
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
    if (!access.capabilities.canManageProject) throw new Error('task_board_manage_forbidden')
    const active = await activeBoardsForScope(ctx, board.projectId, board.groupId)
    const now = Date.now()
    await ctx.db.patch(board._id, { archivedAt: undefined, isDefault: active.length === 0, updatedAt: now })
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
    if (!access.capabilities.canManageProject) throw new Error('task_board_manage_forbidden')
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
    if (!access.capabilities.canManageProject) throw new Error('task_board_manage_forbidden')
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
      await ctx.db.patch(task._id, {
        workflowStateId: replacement!._id,
        terminalAt: replacement && (replacement.category === 'completed' || replacement.category === 'canceled')
          ? task.terminalAt ?? now : undefined,
        revision: task.revision + 1, updatedAt: now,
      })
    }
    await ctx.db.patch(state._id, { archivedAt: now, updatedAt: now })
    return state._id
  },
})
