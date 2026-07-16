import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const snapshotTables = [
  'taskBoards', 'taskWorkflowStates', 'tasks', 'taskLabels', 'taskLabelLinks',
  'taskReferences', 'taskComments', 'taskActivities', 'taskSuggestions',
  'taskSuggestionReferences',
] as const

type SnapshotTable = (typeof snapshotTables)[number]

export async function clearTaskExitStaging(
  ctx: MutationCtx,
  projectCompanyId: Id<'projectCompanies'>,
) {
  const rows = await ctx.db.query('taskExitSnapshotStaging')
    .withIndex('by_project_company', (q) => q.eq('projectCompanyId', projectCompanyId)).collect()
  for (const row of rows) await ctx.db.delete(row._id)
}

export async function captureTaskExitStaging(
  ctx: MutationCtx,
  input: {
    projectCompanyId: Id<'projectCompanies'>
    projectId: Id<'projects'>
    cutoff: number
  },
) {
  await clearTaskExitStaging(ctx, input.projectCompanyId)
  const boards = await ctx.db.query('taskBoards')
    .withIndex('by_project_archived', (q) => q.eq('projectId', input.projectId)).collect()
  const boardGroups = new Map(boards.map((board) => [String(board._id), board.groupId]))
  const tasks = await ctx.db.query('tasks')
    .withIndex('by_project_archived', (q) => q.eq('projectId', input.projectId)).collect()
  const taskGroups = new Map(tasks.map((task) => [String(task._id), task.groupId]))
  const suggestions = await ctx.db.query('taskSuggestions')
    .withIndex('by_project_status', (q) => q.eq('projectId', input.projectId)).collect()
  const suggestionGroups = new Map(suggestions.map((suggestion) => [String(suggestion._id), suggestion.groupId]))
  const rows = {
    taskBoards: boards,
    taskWorkflowStates: (await Promise.all(boards.map((board) => ctx.db.query('taskWorkflowStates')
      .withIndex('by_board_rank', (q) => q.eq('boardId', board._id)).collect()))).flat(),
    tasks,
    taskLabels: await ctx.db.query('taskLabels')
      .withIndex('by_project_archived', (q) => q.eq('projectId', input.projectId)).collect(),
    taskLabelLinks: (await Promise.all(tasks.map((task) => ctx.db.query('taskLabelLinks')
      .withIndex('by_task', (q) => q.eq('taskId', task._id)).collect()))).flat(),
    taskReferences: (await Promise.all(tasks.map((task) => ctx.db.query('taskReferences')
      .withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect()))).flat(),
    taskComments: (await Promise.all(tasks.map((task) => ctx.db.query('taskComments')
      .withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).collect()))).flat(),
    taskActivities: (await Promise.all(tasks.map((task) => ctx.db.query('taskActivities')
      .withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).collect()))).flat(),
    taskSuggestions: suggestions,
    taskSuggestionReferences: (await Promise.all(suggestions.map((suggestion) =>
      ctx.db.query('taskSuggestionReferences')
        .withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestion._id)).collect()))).flat(),
  }
  for (const table of snapshotTables) {
    for (const row of rows[table]) {
      if (row.createdAt > input.cutoff) continue
      const groupId = groupForSnapshot(table, row as never, boardGroups, taskGroups, suggestionGroups)
      await ctx.db.insert('taskExitSnapshotStaging', {
        projectCompanyId: input.projectCompanyId,
        projectId: input.projectId,
        sourceTable: table,
        sourceId: String(row._id),
        groupId,
        payload: row,
        cutoff: input.cutoff,
        createdAt: Date.now(),
      })
    }
  }
}

function groupForSnapshot(
  table: SnapshotTable,
  row: Record<string, unknown>,
  boardGroups: ReadonlyMap<string, Id<'groups'> | undefined>,
  taskGroups: ReadonlyMap<string, Id<'groups'> | undefined>,
  suggestionGroups: ReadonlyMap<string, Id<'groups'> | undefined>,
) {
  if (table === 'taskBoards' || table === 'tasks' || table === 'taskSuggestions') {
    return row.groupId as Id<'groups'> | undefined
  }
  if (table === 'taskWorkflowStates') return boardGroups.get(String(row.boardId))
  if (table === 'taskLabelLinks') return taskGroups.get(String(row.taskId))
  if (table === 'taskReferences') {
    return (row.groupId as Id<'groups'> | undefined) ?? taskGroups.get(String(row.taskId))
  }
  if (table === 'taskComments' || table === 'taskActivities') {
    return (row.originalGroupId as Id<'groups'> | undefined) ?? taskGroups.get(String(row.taskId))
  }
  if (table === 'taskSuggestionReferences') {
    return (row.groupId as Id<'groups'> | undefined) ?? suggestionGroups.get(String(row.suggestionId))
  }
  return undefined
}

export async function materializeTaskArchiveSnapshots(
  ctx: MutationCtx,
  input: {
    entitlementId: Id<'projectArchiveEntitlements'>
    projectCompanyId: Id<'projectCompanies'>
    projectId: Id<'projects'>
    channelIds: ReadonlyArray<Id<'groups'>>
  },
) {
  const allowed = new Set(input.channelIds.map(String))
  const staged = await ctx.db.query('taskExitSnapshotStaging')
    .withIndex('by_project_company', (q) => q.eq('projectCompanyId', input.projectCompanyId)).collect()
  for (const row of staged) {
    if (row.groupId && !allowed.has(String(row.groupId))) continue
    await ctx.db.insert('taskArchiveSnapshots', {
      entitlementId: input.entitlementId,
      projectId: input.projectId,
      sourceTable: row.sourceTable,
      sourceId: row.sourceId,
      groupId: row.groupId,
      payload: row.payload,
      createdAt: Date.now(),
    })
  }
}
