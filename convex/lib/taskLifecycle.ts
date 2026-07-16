import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const snapshotTables = [
  'taskBoards',
  'taskWorkflowStates',
  'tasks',
  'taskLabels',
  'taskLabelLinks',
  'taskReferences',
  'taskComments',
  'taskActivities',
  'taskSuggestions',
  'taskSuggestionReferences',
] as const

type SnapshotTable = (typeof snapshotTables)[number]

export async function deleteTaskProjectData(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
) {
  const [
    boards,
    tasks,
    labels,
    suggestions,
    activities,
    notificationSettings,
    notifications,
    reminderJobs,
    detectionSettings,
    detectionRuns,
    archiveSnapshots,
    exitStaging,
  ] = await Promise.all([
    ctx.db.query('taskBoards').withIndex('by_project_archived', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskLabels').withIndex('by_project_archived', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskSuggestions').withIndex('by_project_status', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskActivities').withIndex('by_project_created_at', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskNotificationSettings').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskNotifications').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskReminderJobs').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskDetectionSettings').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskDetectionRuns').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskArchiveSnapshots').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
    ctx.db.query('taskExitSnapshotStaging').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect(),
  ])
  const workflowStates = (await Promise.all(boards.map((board) =>
    ctx.db.query('taskWorkflowStates').withIndex('by_board_rank', (q) => q.eq('boardId', board._id)).collect(),
  ))).flat()
  const [labelLinks, references, comments, followers] = await Promise.all([
    Promise.all(tasks.map((task) => ctx.db.query('taskLabelLinks')
      .withIndex('by_task', (q) => q.eq('taskId', task._id)).collect())).then((rows) => rows.flat()),
    Promise.all(tasks.map((task) => ctx.db.query('taskReferences')
      .withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect())).then((rows) => rows.flat()),
    Promise.all(tasks.map((task) => ctx.db.query('taskComments')
      .withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).collect())).then((rows) => rows.flat()),
    Promise.all(tasks.map((task) => ctx.db.query('taskFollowers')
      .withIndex('by_task_enabled', (q) => q.eq('taskId', task._id)).collect())).then((rows) => rows.flat()),
  ])
  const [suggestionReferences, suggestionHides] = await Promise.all([
    Promise.all(suggestions.map((suggestion) => ctx.db.query('taskSuggestionReferences')
      .withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestion._id)).collect()))
      .then((rows) => rows.flat()),
    Promise.all(suggestions.map((suggestion) => ctx.db.query('taskSuggestionHides')
      .withIndex('by_suggestion', (q) => q.eq('suggestionId', suggestion._id)).collect()))
      .then((rows) => rows.flat()),
  ])

  for (const job of reminderJobs) {
    if (job.status === 'scheduled' && job.scheduledJobId) {
      await ctx.scheduler.cancel(job.scheduledJobId).catch(() => undefined)
    }
  }
  for (const setting of detectionSettings) {
    if (setting.scheduledJobId) await ctx.scheduler.cancel(setting.scheduledJobId).catch(() => undefined)
  }
  for (const row of labelLinks) await ctx.db.delete(row._id)
  for (const row of references) await ctx.db.delete(row._id)
  for (const row of comments) await ctx.db.delete(row._id)
  for (const row of followers) await ctx.db.delete(row._id)
  for (const row of activities) await ctx.db.delete(row._id)
  for (const row of notifications) await ctx.db.delete(row._id)
  for (const row of reminderJobs) await ctx.db.delete(row._id)
  for (const row of tasks) await ctx.db.delete(row._id)
  for (const row of suggestionReferences) await ctx.db.delete(row._id)
  for (const row of suggestionHides) await ctx.db.delete(row._id)
  for (const row of suggestions) await ctx.db.delete(row._id)
  for (const row of workflowStates) await ctx.db.delete(row._id)
  for (const row of boards) await ctx.db.delete(row._id)
  for (const row of labels) await ctx.db.delete(row._id)
  for (const row of notificationSettings) await ctx.db.delete(row._id)
  for (const row of detectionRuns) await ctx.db.delete(row._id)
  for (const row of detectionSettings) await ctx.db.delete(row._id)
  for (const row of archiveSnapshots) await ctx.db.delete(row._id)
  for (const row of exitStaging) await ctx.db.delete(row._id)
}

export async function removeTaskMemberFromScope(
  ctx: MutationCtx,
  input: {
    projectMemberId: Id<'projectMembers'>
    projectId: Id<'projects'>
    groupId?: Id<'groups'>
  },
) {
  const now = Date.now()
  const assigned = await ctx.db
    .query('tasks')
    .withIndex('by_assignee_archived', (q) =>
      q.eq('assigneeProjectMemberId', input.projectMemberId),
    )
    .collect()
  for (const task of assigned.filter(
    (candidate) =>
      candidate.projectId === input.projectId &&
      (!input.groupId || candidate.groupId === input.groupId),
  )) {
    await ctx.db.patch(task._id, {
      assigneeProjectMemberId: undefined,
      revision: task.revision + 1,
      updatedAt: now,
    })
    await ctx.db.insert('taskActivities', {
      projectId: task.projectId,
      taskId: task._id,
      originalGroupId: task.groupId,
      action: 'assignee_changed',
      before: input.projectMemberId,
      after: null,
      correlationId: `membership-loss:${input.projectMemberId}:${now}`,
      createdAt: now,
    })
    const followers = await ctx.db
      .query('taskFollowers')
      .withIndex('by_task_enabled', (q) =>
        q.eq('taskId', task._id).eq('enabled', true),
      )
      .collect()
    for (const follower of followers.filter(
      (candidate) => candidate.projectMemberId !== input.projectMemberId,
    )) {
      const existing = await ctx.db
        .query('taskNotifications')
        .withIndex('by_member_idempotency', (q) =>
          q
            .eq('recipientProjectMemberId', follower.projectMemberId)
            .eq(
              'idempotencyKey',
              `assignment-lost:${task._id}:${input.projectMemberId}:${task.revision + 1}`,
            ),
        )
        .unique()
      if (!existing)
        await ctx.db.insert('taskNotifications', {
          projectId: task.projectId,
          taskId: task._id,
          recipientProjectMemberId: follower.projectMemberId,
          recipientUserId: follower.userId,
          originalGroupId: task.groupId,
          eventType: 'assignment_lost',
          payload: { publicKey: task.publicKey },
          idempotencyKey: `assignment-lost:${task._id}:${input.projectMemberId}:${task.revision + 1}`,
          createdAt: now,
        })
    }
  }
  const follows = await ctx.db
    .query('taskFollowers')
    .withIndex('by_member_enabled', (q) =>
      q.eq('projectMemberId', input.projectMemberId).eq('enabled', true),
    )
    .collect()
  for (const follow of follows) {
    const task = await ctx.db.get(follow.taskId)
    if (
      task?.projectId === input.projectId &&
      (!input.groupId || task.groupId === input.groupId)
    ) {
      await ctx.db.patch(follow._id, { enabled: false, updatedAt: now })
    }
  }
}

export async function clearTaskExitStaging(
  ctx: MutationCtx,
  projectCompanyId: Id<'projectCompanies'>,
) {
  const rows = await ctx.db
    .query('taskExitSnapshotStaging')
    .withIndex('by_project_company', (q) =>
      q.eq('projectCompanyId', projectCompanyId),
    )
    .collect()
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
  const boards = await ctx.db
    .query('taskBoards')
    .withIndex('by_project_archived', (q) => q.eq('projectId', input.projectId))
    .collect()
  const boardGroups = new Map(
    boards.map((board) => [String(board._id), board.groupId]),
  )
  const tasks = await ctx.db
    .query('tasks')
    .withIndex('by_project_archived', (q) => q.eq('projectId', input.projectId))
    .collect()
  const taskGroups = new Map(
    tasks.map((task) => [String(task._id), task.groupId]),
  )
  const suggestions = await ctx.db
    .query('taskSuggestions')
    .withIndex('by_project_status', (q) => q.eq('projectId', input.projectId))
    .collect()
  const suggestionGroups = new Map(
    suggestions.map((suggestion) => [
      String(suggestion._id),
      suggestion.groupId,
    ]),
  )
  const rows = {
    taskBoards: boards,
    taskWorkflowStates: (
      await Promise.all(
        boards.map((board) =>
          ctx.db
            .query('taskWorkflowStates')
            .withIndex('by_board_rank', (q) => q.eq('boardId', board._id))
            .collect(),
        ),
      )
    ).flat(),
    tasks,
    taskLabels: await ctx.db
      .query('taskLabels')
      .withIndex('by_project_archived', (q) =>
        q.eq('projectId', input.projectId),
      )
      .collect(),
    taskLabelLinks: (
      await Promise.all(
        tasks.map((task) =>
          ctx.db
            .query('taskLabelLinks')
            .withIndex('by_task', (q) => q.eq('taskId', task._id))
            .collect(),
        ),
      )
    ).flat(),
    taskReferences: (
      await Promise.all(
        tasks.map((task) =>
          ctx.db
            .query('taskReferences')
            .withIndex('by_task_rank', (q) => q.eq('taskId', task._id))
            .collect(),
        ),
      )
    ).flat(),
    taskComments: (
      await Promise.all(
        tasks.map((task) =>
          ctx.db
            .query('taskComments')
            .withIndex('by_task_created_at', (q) => q.eq('taskId', task._id))
            .collect(),
        ),
      )
    ).flat(),
    taskActivities: (
      await Promise.all(
        tasks.map((task) =>
          ctx.db
            .query('taskActivities')
            .withIndex('by_task_created_at', (q) => q.eq('taskId', task._id))
            .collect(),
        ),
      )
    ).flat(),
    taskSuggestions: suggestions,
    taskSuggestionReferences: (
      await Promise.all(
        suggestions.map((suggestion) =>
          ctx.db
            .query('taskSuggestionReferences')
            .withIndex('by_suggestion_rank', (q) =>
              q.eq('suggestionId', suggestion._id),
            )
            .collect(),
        ),
      )
    ).flat(),
  }
  for (const table of snapshotTables) {
    for (const row of rows[table]) {
      if (row.createdAt > input.cutoff) continue
      const groupId = groupForSnapshot(
        table,
        row as never,
        boardGroups,
        taskGroups,
        suggestionGroups,
      )
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
  if (
    table === 'taskBoards' ||
    table === 'tasks' ||
    table === 'taskSuggestions'
  ) {
    return row.groupId as Id<'groups'> | undefined
  }
  if (table === 'taskWorkflowStates')
    return boardGroups.get(String(row.boardId))
  if (table === 'taskLabelLinks') return taskGroups.get(String(row.taskId))
  if (table === 'taskReferences') {
    return (
      (row.groupId as Id<'groups'> | undefined) ??
      taskGroups.get(String(row.taskId))
    )
  }
  if (table === 'taskComments' || table === 'taskActivities') {
    return (
      (row.originalGroupId as Id<'groups'> | undefined) ??
      taskGroups.get(String(row.taskId))
    )
  }
  if (table === 'taskSuggestionReferences') {
    return (
      (row.groupId as Id<'groups'> | undefined) ??
      suggestionGroups.get(String(row.suggestionId))
    )
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
  const staged = await ctx.db
    .query('taskExitSnapshotStaging')
    .withIndex('by_project_company', (q) =>
      q.eq('projectCompanyId', input.projectCompanyId),
    )
    .collect()
  for (const row of staged) {
    if (row.groupId && !allowed.has(String(row.groupId))) continue
    const payload = row.payload as {
      messageId?: Id<'messages'>
      attachmentId?: Id<'attachments'>
      assistantStreamId?: Id<'assistantStreams'>
    }
    await ctx.db.insert('taskArchiveSnapshots', {
      entitlementId: input.entitlementId,
      projectId: input.projectId,
      sourceTable: row.sourceTable,
      sourceId: row.sourceId,
      groupId: row.groupId,
      messageId: payload.messageId,
      attachmentId: payload.attachmentId,
      assistantStreamId: payload.assistantStreamId,
      payload,
      createdAt: Date.now(),
    })
  }
}
