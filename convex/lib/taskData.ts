import { isTerminalTaskState } from '@track/shared/tasks'

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type TaskDataCtx = QueryCtx | MutationCtx

const publicKeyAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export async function createUniqueTaskPublicKey(ctx: MutationCtx, projectId: Id<'projects'>) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    const value = Array.from(bytes, (byte) => publicKeyAlphabet[byte % publicKeyAlphabet.length]).join('')
    const publicKey = `T-${value}`
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_project_key', (q) => q.eq('projectId', projectId).eq('publicKey', publicKey))
      .unique()
    if (!existing) return publicKey
  }
  throw new Error('task_key_generation_failed')
}

export async function getDefaultWorkflowState(ctx: TaskDataCtx, boardId: Id<'taskBoards'>) {
  const state = await ctx.db
    .query('taskWorkflowStates')
    .withIndex('by_board_default', (q) => q.eq('boardId', boardId).eq('isDefault', true))
    .unique()
  if (!state || state.archivedAt) throw new Error('task_destination_invalid')
  return state
}

export function rankForIndex(index: number) {
  return (index + 1).toString(36).padStart(8, '0')
}

export async function appendTaskActivity(
  ctx: MutationCtx,
  input: {
    task: Doc<'tasks'>
    action: Doc<'taskActivities'>['action']
    actorProjectMemberId?: Id<'projectMembers'>
    actingCompanyId?: Id<'companies'>
    before?: unknown
    after?: unknown
    correlationId?: string
  },
) {
  await ctx.db.insert('taskActivities', {
    projectId: input.task.projectId,
    taskId: input.task._id,
    originalGroupId: input.task.groupId,
    actorProjectMemberId: input.actorProjectMemberId,
    actingCompanyId: input.actingCompanyId,
    action: input.action,
    before: input.before,
    after: input.after,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    createdAt: Date.now(),
  })
}

export async function taskView(
  ctx: TaskDataCtx,
  task: Doc<'tasks'>,
  accessibleOriginalGroups: ReadonlySet<string> = new Set(),
) {
  const [board, state, assignee, creator, labelLinks, references] = await Promise.all([
    ctx.db.get(task.boardId),
    ctx.db.get(task.workflowStateId),
    task.assigneeProjectMemberId ? ctx.db.get(task.assigneeProjectMemberId) : null,
    ctx.db.get(task.createdByProjectMemberId),
    ctx.db.query('taskLabelLinks').withIndex('by_task', (q) => q.eq('taskId', task._id)).collect(),
    ctx.db.query('taskReferences').withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect(),
  ])
  const labels = await Promise.all(labelLinks.map((link) => ctx.db.get(link.labelId)))
  const visibleReferences = []
  for (const reference of references.filter((candidate) =>
    !candidate.groupId || candidate.groupId === task.groupId ||
    accessibleOriginalGroups.has(String(candidate.groupId)),
  )) {
    const source = reference.messageId ? await ctx.db.get(reference.messageId)
      : reference.attachmentId ? await ctx.db.get(reference.attachmentId)
        : reference.assistantStreamId ? await ctx.db.get(reference.assistantStreamId)
          : reference.memoryImportId ? await ctx.db.get(reference.memoryImportId) : null
    const sourceScopeMatches = source && reference.memoryImportId && 'scope' in source
      ? source.scope === 'project' ? reference.groupId === undefined : source.groupId === reference.groupId
      : Boolean(source && (!('groupId' in source) || source.groupId === reference.groupId))
    const sourceAvailable = Boolean(source && source.projectId === task.projectId && sourceScopeMatches &&
      (!('status' in source) || reference.assistantStreamId === undefined || source.status === 'completed'))
    visibleReferences.push({
      ...reference,
      availability: sourceAvailable ? reference.availability : 'unavailable' as const,
      quote: sourceAvailable && reference.availability === 'available' ? reference.quote : undefined,
    })
  }
  return {
    task,
    board,
    state,
    assignee,
    creator,
    labels: labels.filter(Boolean),
    references: visibleReferences,
    terminal: state ? isTerminalTaskState(state.category) : false,
  }
}

export async function archivedTaskViews(
  ctx: TaskDataCtx,
  entitlementId: Id<'projectArchiveEntitlements'>,
) {
  const tables = await Promise.all([
    'tasks', 'taskBoards', 'taskWorkflowStates', 'taskLabels', 'taskLabelLinks',
    'taskReferences', 'taskComments', 'taskActivities',
  ].map(async (sourceTable) => await ctx.db.query('taskArchiveSnapshots')
    .withIndex('by_entitlement_table', (q) =>
      q.eq('entitlementId', entitlementId).eq('sourceTable', sourceTable),
    ).collect()))
  const [taskRows, boardRows, stateRows, labelRows, linkRows, referenceRows, commentRows, activityRows] = tables
  const boards = new Map(boardRows.map((row) => [row.sourceId, row.payload as Doc<'taskBoards'>]))
  const states = new Map(stateRows.map((row) => [row.sourceId, row.payload as Doc<'taskWorkflowStates'>]))
  const labels = new Map(labelRows.map((row) => [row.sourceId, row.payload as Doc<'taskLabels'>]))
  return taskRows.map((row) => {
    const task = row.payload as Doc<'tasks'>
    const taskLinks = linkRows.map((link) => link.payload as Doc<'taskLabelLinks'>)
      .filter((link) => String(link.taskId) === String(task._id))
    return {
      task,
      board: boards.get(String(task.boardId)) ?? null,
      state: states.get(String(task.workflowStateId)) ?? null,
      assignee: null,
      creator: null,
      labels: taskLinks.flatMap((link) => {
        const label = labels.get(String(link.labelId))
        return label ? [label] : []
      }),
      references: referenceRows.map((reference) => reference.payload as Doc<'taskReferences'>)
        .filter((reference) => String(reference.taskId) === String(task._id))
        .map((reference) => ({
          ...reference,
          quote: reference.availability === 'available' ? reference.quote : undefined,
        })),
      comments: commentRows.map((comment) => comment.payload as Doc<'taskComments'>)
        .filter((comment) => String(comment.taskId) === String(task._id)),
      activities: activityRows.map((activity) => activity.payload as Doc<'taskActivities'>)
        .filter((activity) => String(activity.taskId) === String(task._id)),
      terminal: Boolean(states.get(String(task.workflowStateId)) &&
        isTerminalTaskState(states.get(String(task.workflowStateId))!.category)),
      following: false,
      capabilities: {
        canView: true, canCreate: false, canEdit: false, canAssignOthers: false,
        canTransfer: false, canManage: false, canChangeScope: false,
        canArchive: false, canComment: false,
      },
      restrictedEarlierContext: false,
    }
  })
}
