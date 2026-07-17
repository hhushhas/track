import {
  isTaskDescription,
  isTaskDueDate,
  isTaskTitle,
  isTerminalTaskState,
  getTaskDueState,
  normalizeTaskText,
  resolveTaskCapabilities,
} from '@track/shared/tasks'
import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { appendAuditEvent } from './lib/audit'
import { threadsEnabled } from './lib/channelThreadPolicy'
import { createTaskNotification, notifyTaskFollowers } from './lib/taskNotifications'
import { invalidateTaskEvidence } from './lib/taskEvidence'
import {
  appendTaskActivity,
  archivedTaskViews,
  createUniqueTaskPublicKey,
  getDefaultWorkflowState,
  rankForIndex,
  taskView,
} from './lib/taskData'
import {
  assertCanAssignTaskMember,
  requireEligibleTaskMember,
  requireTaskAccess,
  requireTaskBoardAccess,
  resolveTaskRequestContext,
} from './lib/taskPolicy'
import { taskPriority, taskStateCategory } from './schema/taskValidators'
import { getOrCreateDefaultBoard } from './taskBoards'
import { rescheduleTaskReminders } from './taskReminders'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

const referenceInput = v.object({
  type: v.union(
    v.literal('message'), v.literal('attachment'),
    v.literal('assistant_answer'), v.literal('memory_excerpt'),
  ),
  messageId: v.optional(v.id('messages')),
  attachmentId: v.optional(v.id('attachments')),
  assistantStreamId: v.optional(v.id('assistantStreams')),
  memoryImportId: v.optional(v.id('memoryImports')),
  sourceIdentifier: v.optional(v.string()),
  isPrimary: v.optional(v.boolean()),
})

type ReferenceInput = {
  type: Doc<'taskReferences'>['type']
  messageId?: Id<'messages'>
  attachmentId?: Id<'attachments'>
  assistantStreamId?: Id<'assistantStreams'>
  memoryImportId?: Id<'memoryImports'>
  sourceIdentifier?: string
  isPrimary?: boolean
}

function validateTaskFields(input: { title: string; description?: string; dueDate?: string }) {
  if (!isTaskTitle(input.title)) throw new Error('task_title_invalid')
  if (input.description !== undefined && !isTaskDescription(input.description)) {
    throw new Error('task_description_invalid')
  }
  if (input.dueDate !== undefined && !isTaskDueDate(input.dueDate)) {
    throw new Error('task_due_date_invalid')
  }
}

async function validateReference(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  groupId: Id<'groups'> | undefined,
  reference: ReferenceInput,
) {
  const source = reference.messageId
    ? await ctx.db.get(reference.messageId)
    : reference.attachmentId
      ? await ctx.db.get(reference.attachmentId)
      : reference.assistantStreamId
        ? await ctx.db.get(reference.assistantStreamId)
        : reference.memoryImportId
          ? await ctx.db.get(reference.memoryImportId)
          : null
  if (!source || source.projectId !== projectId || ('groupId' in source && source.groupId !== groupId)) {
    throw new Error('task_reference_invalid')
  }
  const channelThreadId = 'channelThreadId' in source
    ? source.channelThreadId as Id<'channelThreads'> | undefined
    : undefined
  if (channelThreadId && !threadsEnabled()) throw new Error('task_reference_invalid')
  return { source, channelThreadId }
}

async function addFollower(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  member: Doc<'projectMembers'>,
  reason: Doc<'taskFollowers'>['reason'],
) {
  const existing = await ctx.db.query('taskFollowers')
    .withIndex('by_task_member', (q) => q.eq('taskId', task._id).eq('projectMemberId', member._id))
    .unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, { enabled: true, reason, updatedAt: now })
    return
  }
  await ctx.db.insert('taskFollowers', {
    projectId: task.projectId,
    taskId: task._id,
    userId: member.userId,
    projectMemberId: member._id,
    reason,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertReference(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  actorProjectMemberId: Id<'projectMembers'>,
  actingCompanyId: Id<'companies'> | undefined,
  reference: ReferenceInput,
  index: number,
) {
  const { source, channelThreadId } = await validateReference(ctx, task.projectId, task.groupId, reference)
  const quote = 'body' in source
    ? source.body.slice(0, 280)
    : 'answer' in source && typeof source.answer === 'string'
      ? source.answer.slice(0, 280)
      : 'filename' in source
        ? source.filename.slice(0, 280)
        : undefined
  return await ctx.db.insert('taskReferences', {
    projectId: task.projectId,
    taskId: task._id,
    type: reference.type,
    groupId: task.groupId,
    channelThreadId,
    messageId: reference.messageId,
    attachmentId: reference.attachmentId,
    assistantStreamId: reference.assistantStreamId,
    memoryImportId: reference.memoryImportId,
    sourceIdentifier: reference.sourceIdentifier,
    quote,
    availability: 'available',
    isPrimary: reference.isPrimary === true || index === 0,
    actorProjectMemberId,
    actingCompanyId,
    rank: rankForIndex(index),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export const list = query({
  args: {
    projectId: v.id('projects'),
    boardId: v.optional(v.id('taskBoards')),
    groupId: v.optional(v.id('groups')),
    assigneeProjectMemberId: v.optional(v.id('projectMembers')),
    creatorProjectMemberId: v.optional(v.id('projectMembers')),
    workflowStateId: v.optional(v.id('taskWorkflowStates')),
    stateCategory: v.optional(taskStateCategory),
    priority: v.optional(taskPriority),
    dueState: v.optional(v.union(v.literal('none'), v.literal('upcoming'), v.literal('due_today'), v.literal('overdue'))),
    localDate: v.optional(v.string()),
    labelId: v.optional(v.id('taskLabels')),
    openOnly: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (access.capabilities.accessMode === 'archive' && access.entitlement) {
      const archived = await archivedTaskViews(ctx, access.entitlement._id)
      return archived.filter((view) =>
        (args.includeArchived || !view.task.archivedAt) &&
        (!args.boardId || view.task.boardId === args.boardId) &&
        (!args.groupId || view.task.groupId === args.groupId) &&
        (!args.assigneeProjectMemberId || view.task.assigneeProjectMemberId === args.assigneeProjectMemberId) &&
        (!args.creatorProjectMemberId || view.task.createdByProjectMemberId === args.creatorProjectMemberId) &&
        (!args.workflowStateId || view.task.workflowStateId === args.workflowStateId) &&
        (!args.stateCategory || view.state?.category === args.stateCategory) &&
        (!args.priority || view.task.priority === args.priority) &&
        (!args.openOnly || !view.state || !isTerminalTaskState(view.state.category)) &&
        (!args.dueState || getTaskDueState(view.task.dueDate, args.localDate ?? new Date().toISOString().slice(0, 10), Boolean(view.state && isTerminalTaskState(view.state.category))) === args.dueState) &&
        (!args.labelId || view.labels.some((label) => label._id === args.labelId)),
      )
    }
    const rows = args.assigneeProjectMemberId
      ? await ctx.db.query('tasks')
          .withIndex('by_assignee_archived', (q) => q.eq('assigneeProjectMemberId', args.assigneeProjectMemberId))
          .collect()
      : await ctx.db.query('tasks')
          .withIndex('by_project_archived', (q) => q.eq('projectId', args.projectId))
          .collect()
    const visible = []
    for (const task of rows) {
      if (task.projectId !== args.projectId) continue
      if (!args.includeArchived && task.archivedAt) continue
      const board = await ctx.db.get(task.boardId)
      if (!board || (!args.includeArchived && board.archivedAt)) continue
      if (args.boardId && task.boardId !== args.boardId) continue
      if (args.groupId && task.groupId !== args.groupId) continue
      if (args.creatorProjectMemberId && task.createdByProjectMemberId !== args.creatorProjectMemberId) continue
      if (args.workflowStateId && task.workflowStateId !== args.workflowStateId) continue
      if (args.priority && task.priority !== args.priority) continue
      const state = await ctx.db.get(task.workflowStateId)
      if (!state) continue
      if (args.stateCategory && state.category !== args.stateCategory) continue
      if (args.openOnly && isTerminalTaskState(state.category)) continue
      if (args.dueState && getTaskDueState(task.dueDate, args.localDate ?? new Date().toISOString().slice(0, 10), isTerminalTaskState(state.category)) !== args.dueState) continue
      if (args.labelId) {
        const link = await ctx.db.query('taskLabelLinks')
          .withIndex('by_task_label', (q) => q.eq('taskId', task._id).eq('labelId', args.labelId!)).unique()
        if (!link) continue
      }
      if (task.groupId) {
        try {
          const scoped = await resolveTaskRequestContext(ctx, actor, task.projectId, args, task.groupId)
          if (!scoped.capabilities.canReadChannel) continue
        } catch {
          continue
        }
      } else if (!access.capabilities.canReadProject) continue
      visible.push(await taskView(ctx, task))
    }
    return visible
  },
})

export const getByKey = query({
  args: { projectId: v.id('projects'), publicKey: v.string(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const projectAccess = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (projectAccess.capabilities.accessMode === 'archive' && projectAccess.entitlement) {
      const archived = await archivedTaskViews(ctx, projectAccess.entitlement._id)
      return archived.find((view) => view.task.publicKey === args.publicKey) ?? null
    }
    const task = await ctx.db.query('tasks')
      .withIndex('by_project_key', (q) => q.eq('projectId', args.projectId).eq('publicKey', args.publicKey))
      .unique()
    if (!task) return null
    try {
      const access = await requireTaskAccess(ctx, actor, task._id, args)
      const [comments, activities, follow, references] = await Promise.all([
        ctx.db.query('taskComments').withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).collect(),
        ctx.db.query('taskActivities').withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).collect(),
        ctx.db.query('taskFollowers').withIndex('by_task_member', (q) =>
          q.eq('taskId', task._id).eq('projectMemberId', access.projectMember._id),
        ).unique(),
        ctx.db.query('taskReferences').withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect(),
      ])
      const originalGroups = new Set<string>()
      for (const groupId of new Set([
        ...comments.map((comment) => comment.originalGroupId),
        ...activities.map((activity) => activity.originalGroupId),
        ...references.map((reference) => reference.groupId),
      ].filter(Boolean))) {
        try {
          const scoped = await resolveTaskRequestContext(ctx, actor, task.projectId, args, groupId)
          if (scoped.capabilities.canReadChannel) originalGroups.add(String(groupId))
        } catch {
          continue
        }
      }
      const view = await taskView(ctx, task, originalGroups)
      const visibleComments = comments.filter((comment) => !comment.originalGroupId ||
        comment.originalGroupId === task.groupId || originalGroups.has(String(comment.originalGroupId)))
      const visibleActivities = activities.filter((activity) => !activity.originalGroupId ||
        activity.originalGroupId === task.groupId || originalGroups.has(String(activity.originalGroupId)))
      return {
        ...view,
        comments: visibleComments,
        activities: visibleActivities,
        following: follow?.enabled ?? false,
        capabilities: access.taskCapabilities,
        currentProjectMemberId: access.projectMember._id,
        restrictedEarlierContext: comments.length !== visibleComments.length ||
          activities.length !== visibleActivities.length || references.length !== view.references.length,
      }
    } catch {
      return null
    }
  },
})

export const listEligibleAssignees = query({
  args: { projectId: v.id('projects'), groupId: v.optional(v.id('groups')), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
    if (args.groupId && !access.capabilities.canReadChannel) throw new Error('task_access_changed')
    if (access.capabilities.accessMode !== 'active') return []
    const members = await ctx.db.query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect()
    const eligible = []
    for (const member of members) {
      if (member.status !== undefined && member.status !== 'active') continue
      try {
        await requireEligibleTaskMember(ctx, {
          projectId: args.projectId, groupId: args.groupId, projectMemberId: member._id,
        })
      } catch {
        continue
      }
      const [user, company] = await Promise.all([
        ctx.db.get(member.userId), member.companyId ? ctx.db.get(member.companyId) : null,
      ])
      if (user) eligible.push({ member, user: { _id: user._id, displayName: user.displayName }, company })
    }
    return eligible
  },
})

export const listForMessage = query({
  args: { messageId: v.id('messages'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) return []
    if (message.channelThreadId && !threadsEnabled()) return []
    const access = await resolveTaskRequestContext(ctx, actor, message.projectId, args, message.groupId)
    if (!access.capabilities.canReadChannel) return []
    if (access.capabilities.accessMode === 'archive' && access.entitlement) {
      return (await archivedTaskViews(ctx, access.entitlement._id))
        .filter((view) => !view.task.archivedAt && view.task.groupId === message.groupId &&
          view.references.some((reference) => reference.messageId === message._id &&
            reference.availability === 'available'))
        .map(({ task, state, assignee }) => ({ task, state, assignee }))
    }
    const references = await ctx.db.query('taskReferences')
      .withIndex('by_message', (q) => q.eq('messageId', message._id)).collect()
    const cards = []
    for (const reference of references) {
      if (reference.availability !== 'available') continue
      const task = await ctx.db.get(reference.taskId)
      if (!task || task.archivedAt || task.groupId !== message.groupId) continue
      const [state, assignee] = await Promise.all([
        ctx.db.get(task.workflowStateId),
        task.assigneeProjectMemberId ? ctx.db.get(task.assigneeProjectMemberId) : null,
      ])
      cards.push({ task, state, assignee })
    }
    return cards
  },
})

export const listForAssistant = query({
  args: { assistantStreamId: v.id('assistantStreams'), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const stream = await ctx.db.get(args.assistantStreamId)
    if (!stream || stream.status !== 'completed') return []
    if (stream.channelThreadId && !threadsEnabled()) return []
    const access = await resolveTaskRequestContext(ctx, actor, stream.projectId, args, stream.groupId)
    if (!access.capabilities.canReadChannel) return []
    if (access.capabilities.accessMode === 'archive' && access.entitlement) {
      return (await archivedTaskViews(ctx, access.entitlement._id))
        .filter((view) => !view.task.archivedAt && view.task.groupId === stream.groupId &&
          view.references.some((reference) => reference.assistantStreamId === stream._id &&
            reference.availability === 'available'))
        .map(({ task, state, assignee }) => ({ task, state, assignee }))
    }
    const references = await ctx.db.query('taskReferences')
      .withIndex('by_assistant_stream', (q) => q.eq('assistantStreamId', stream._id)).collect()
    const cards = []
    for (const reference of references) {
      if (reference.availability !== 'available') continue
      const task = await ctx.db.get(reference.taskId)
      if (!task || task.archivedAt || task.groupId !== stream.groupId) continue
      const [state, assignee] = await Promise.all([
        ctx.db.get(task.workflowStateId),
        task.assigneeProjectMemberId ? ctx.db.get(task.assigneeProjectMemberId) : null,
      ])
      cards.push({ task, state, assignee })
    }
    return cards
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    boardId: v.optional(v.id('taskBoards')),
    workflowStateId: v.optional(v.id('taskWorkflowStates')),
    groupId: v.optional(v.id('groups')),
    parentTaskId: v.optional(v.id('tasks')),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeProjectMemberId: v.optional(v.id('projectMembers')),
    priority: taskPriority,
    dueDate: v.optional(v.string()),
    labelIds: v.optional(v.array(v.id('taskLabels'))),
    references: v.optional(v.array(referenceInput)),
    idempotencyKey: v.string(),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    validateTaskFields(args)
    const existing = await ctx.db.query('tasks')
      .withIndex('by_project_idempotency', (q) =>
        q.eq('projectId', args.projectId).eq('createIdempotencyKey', args.idempotencyKey),
      ).unique()
    if (existing) return { publicKey: existing.publicKey, taskId: existing._id }

    let initialAccess
    let board: Doc<'taskBoards'>
    if (args.boardId) {
      const boardAccess = await requireTaskBoardAccess(ctx, actor, args.boardId, args)
      initialAccess = boardAccess
      board = boardAccess.board
    } else {
      initialAccess = await resolveTaskRequestContext(ctx, actor, args.projectId, args, args.groupId)
      board = await getOrCreateDefaultBoard(ctx, {
        projectId: args.projectId,
        groupId: args.groupId,
        projectMemberId: initialAccess.projectMember._id,
        actingCompanyId: initialAccess.actingCompanyId,
        channelName: initialAccess.group?.name,
      })
    }
    const groupId = board.groupId
    const baseCapabilities = resolveTaskCapabilities({
      collaboration: initialAccess.capabilities.taskCollaboration,
      activeScope: initialAccess.capabilities.accessMode === 'active',
      channelMember: groupId ? initialAccess.capabilities.canReadChannel : initialAccess.capabilities.canReadProject,
      createdByActor: true,
      assignedToActor: args.assigneeProjectMemberId === initialAccess.projectMember._id,
    })
    if (!baseCapabilities.canCreate) throw new Error('task_access_changed')

    if (board.projectId !== args.projectId || board.groupId !== groupId || board.archivedAt) {
      throw new Error('task_destination_invalid')
    }
    const state = args.workflowStateId
      ? await ctx.db.get(args.workflowStateId)
      : await getDefaultWorkflowState(ctx, board._id)
    if (!state || state.boardId !== board._id || state.archivedAt) {
      throw new Error('task_destination_invalid')
    }
    assertCanAssignTaskMember(
      initialAccess.projectMember._id,
      args.assigneeProjectMemberId,
      baseCapabilities.canAssignOthers,
    )
    const assignee = args.assigneeProjectMemberId
      ? await requireEligibleTaskMember(ctx, {
          projectId: args.projectId, groupId, projectMemberId: args.assigneeProjectMemberId,
        })
      : null

    let parent: Doc<'tasks'> | null = null
    if (args.parentTaskId) {
      parent = await ctx.db.get(args.parentTaskId)
      if (!parent || parent.parentTaskId || parent.projectId !== args.projectId ||
        parent.boardId !== board._id || parent.groupId !== groupId) {
        throw new Error('task_parent_invalid')
      }
    }
    const stateTasks = await ctx.db.query('tasks')
      .withIndex('by_board_state_rank', (q) => q.eq('boardId', board._id).eq('workflowStateId', state._id))
      .collect()
    const now = Date.now()
    const taskId = await ctx.db.insert('tasks', {
      projectId: args.projectId,
      publicKey: await createUniqueTaskPublicKey(ctx, args.projectId),
      boardId: board._id,
      groupId,
      parentTaskId: parent?._id,
      workflowStateId: state._id,
      rank: rankForIndex(stateTasks.length),
      title: normalizeTaskText(args.title),
      description: args.description?.trim() || undefined,
      searchText: `${normalizeTaskText(args.title)} ${args.description?.trim() ?? ''} `,
      assigneeProjectMemberId: assignee?._id,
      priority: args.priority,
      dueDate: args.dueDate,
      createdByProjectMemberId: initialAccess.projectMember._id,
      actingCompanyId: initialAccess.actingCompanyId,
      revision: 1,
      createIdempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    const task = await ctx.db.get(taskId)
    if (!task) throw new Error('task_create_failed')

    for (const [index, reference] of (args.references ?? []).entries()) {
      await insertReference(ctx, task, initialAccess.projectMember._id, initialAccess.actingCompanyId, reference, index)
    }
    for (const labelId of args.labelIds ?? []) {
      const label = await ctx.db.get(labelId)
      if (!label || label.projectId !== task.projectId || label.archivedAt) throw new Error('task_label_invalid')
      await ctx.db.insert('taskLabelLinks', { projectId: task.projectId, taskId, labelId, createdAt: now })
    }
    await addFollower(ctx, task, initialAccess.projectMember, 'creator')
    if (assignee && assignee._id !== initialAccess.projectMember._id) await addFollower(ctx, task, assignee, 'assignee')
    await appendTaskActivity(ctx, {
      task, action: 'created', actorProjectMemberId: initialAccess.projectMember._id,
      actingCompanyId: initialAccess.actingCompanyId,
    })
    if (assignee) await createTaskNotification(ctx, {
      task, recipient: assignee, actorProjectMemberId: initialAccess.projectMember._id,
      eventType: 'assignment', payload: { publicKey: task.publicKey },
      idempotencyKey: `assignment:${task._id}:${assignee._id}:1`,
    })
    await rescheduleTaskReminders(ctx, task)
    await appendAuditEvent(ctx, {
      projectId: task.projectId, groupId: task.groupId, actorId: actor.userId,
      actorProjectMemberId: initialAccess.projectMember._id, actingCompanyId: initialAccess.actingCompanyId,
      entityType: 'task', entityId: String(task._id), action: 'created',
    })
    return { publicKey: task.publicKey, taskId: task._id }
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    expectedRevision: v.number(),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    workflowStateId: v.optional(v.id('taskWorkflowStates')),
    assigneeProjectMemberId: v.optional(v.union(v.id('projectMembers'), v.null())),
    priority: v.optional(taskPriority),
    dueDate: v.optional(v.union(v.string(), v.null())),
    confirmOpenSubtasks: v.optional(v.boolean()),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canEdit) throw new Error('task_edit_forbidden')
    if (access.task.revision !== args.expectedRevision) {
      throw new Error(`task_conflict:${access.task.revision}`)
    }
    if (args.title !== undefined && !isTaskTitle(args.title)) throw new Error('task_title_invalid')
    if (typeof args.description === 'string' && !isTaskDescription(args.description)) throw new Error('task_description_invalid')
    if (typeof args.dueDate === 'string' && !isTaskDueDate(args.dueDate)) throw new Error('task_due_date_invalid')

    const patch: Partial<Doc<'tasks'>> = {}
    let assignedMember: Doc<'projectMembers'> | null = null
    const changes: Array<{ action: Doc<'taskActivities'>['action']; before: unknown; after: unknown }> = []
    if (args.title !== undefined && normalizeTaskText(args.title) !== access.task.title) {
      patch.title = normalizeTaskText(args.title)
      changes.push({ action: 'title_changed', before: access.task.title, after: patch.title })
    }
    if (args.description !== undefined && (args.description || undefined) !== access.task.description) {
      patch.description = args.description?.trim() || undefined
      changes.push({ action: 'description_changed', before: Boolean(access.task.description), after: Boolean(patch.description) })
    }
    if (args.priority !== undefined && args.priority !== access.task.priority) {
      patch.priority = args.priority
      changes.push({ action: 'priority_changed', before: access.task.priority, after: args.priority })
    }
    if (args.dueDate !== undefined && (args.dueDate || undefined) !== access.task.dueDate) {
      patch.dueDate = args.dueDate || undefined
      changes.push({ action: 'due_date_changed', before: access.task.dueDate, after: patch.dueDate })
    }
    if (args.assigneeProjectMemberId !== undefined) {
      const nextAssigneeId = args.assigneeProjectMemberId || undefined
      if (nextAssigneeId !== access.task.assigneeProjectMemberId) {
        if (!nextAssigneeId && access.task.assigneeProjectMemberId !== access.projectMember._id &&
          !access.taskCapabilities.canAssignOthers) {
          throw new Error('task_assignment_forbidden')
        }
        assertCanAssignTaskMember(
          access.projectMember._id,
          nextAssigneeId,
          access.taskCapabilities.canAssignOthers,
        )
      }
      if (nextAssigneeId !== access.task.assigneeProjectMemberId) {
        const assignee = nextAssigneeId ? await requireEligibleTaskMember(ctx, {
          projectId: access.task.projectId, groupId: access.task.groupId, projectMemberId: nextAssigneeId,
        }) : null
        assignedMember = assignee
        patch.assigneeProjectMemberId = nextAssigneeId
        changes.push({ action: 'assignee_changed', before: access.task.assigneeProjectMemberId, after: nextAssigneeId })
        if (assignee) await addFollower(ctx, access.task, assignee, 'assignee')
      }
    }
    if (args.workflowStateId && args.workflowStateId !== access.task.workflowStateId) {
      const state = await ctx.db.get(args.workflowStateId)
      if (!state || state.boardId !== access.task.boardId || state.archivedAt) throw new Error('task_destination_invalid')
      if (isTerminalTaskState(state.category) && !access.task.parentTaskId) {
        const subtasks = await ctx.db.query('tasks').withIndex('by_parent', (q) => q.eq('parentTaskId', access.task._id)).collect()
        const open = []
        for (const subtask of subtasks) {
          const subtaskState = await ctx.db.get(subtask.workflowStateId)
          if (subtaskState && !isTerminalTaskState(subtaskState.category) && !subtask.archivedAt) open.push(subtask)
        }
        if (open.length && !args.confirmOpenSubtasks) throw new Error('task_open_subtasks_confirmation_required')
      }
      patch.workflowStateId = state._id
      patch.terminalAt = isTerminalTaskState(state.category) ? access.task.terminalAt ?? Date.now() : undefined
      changes.push({ action: 'state_changed', before: access.task.workflowStateId, after: state._id })
    }
    if (!changes.length) return access.task.revision
    const nextDescription = args.description !== undefined
      ? args.description?.trim() || undefined
      : access.task.description
    patch.searchText = `${patch.title ?? access.task.title} ${nextDescription ?? ''} `
    const now = Date.now()
    await ctx.db.patch(access.task._id, { ...patch, revision: access.task.revision + 1, updatedAt: now })
    const updated = await ctx.db.get(access.task._id)
    if (!updated) throw new Error('task_access_changed')
    const correlationId = crypto.randomUUID()
    for (const change of changes) {
      await appendTaskActivity(ctx, {
        task: updated, ...change, actorProjectMemberId: access.projectMember._id,
        actingCompanyId: access.actingCompanyId, correlationId,
      })
    }
    if (assignedMember) await createTaskNotification(ctx, {
      task: updated, recipient: assignedMember, actorProjectMemberId: access.projectMember._id,
      eventType: 'assignment', payload: { publicKey: updated.publicKey },
      idempotencyKey: `assignment:${updated._id}:${assignedMember._id}:${updated.revision}`,
    })
    await notifyTaskFollowers(ctx, {
      task: updated, actorProjectMemberId: access.projectMember._id,
      eventType: 'task_changed', payload: { publicKey: updated.publicKey },
      idempotencyKey: `changed:${updated._id}:${updated.revision}`,
    })
    await rescheduleTaskReminders(ctx, updated)
    return updated.revision
  },
})

export const move = mutation({
  args: {
    taskId: v.id('tasks'), destinationBoardId: v.id('taskBoards'),
    workflowStateId: v.optional(v.id('taskWorkflowStates')), targetIndex: v.number(),
    expectedRevision: v.number(), ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canTransfer) throw new Error('task_move_forbidden')
    if (access.task.revision !== args.expectedRevision) throw new Error(`task_conflict:${access.task.revision}`)
    const board = await ctx.db.get(args.destinationBoardId)
    if (!board || board.archivedAt || board.projectId !== access.task.projectId || board.groupId !== access.task.groupId) {
      throw new Error('task_destination_invalid')
    }
    if (access.task.parentTaskId && board._id !== access.task.boardId) {
      throw new Error('task_destination_invalid')
    }
    const state = args.workflowStateId ? await ctx.db.get(args.workflowStateId) : await getDefaultWorkflowState(ctx, board._id)
    if (!state || state.boardId !== board._id || state.archivedAt) throw new Error('task_destination_invalid')
    const rows = (await ctx.db.query('tasks')
      .withIndex('by_board_state_rank', (q) => q.eq('boardId', board._id).eq('workflowStateId', state._id))
      .collect()).filter((task) => task._id !== access.task._id)
    const targetIndex = Math.max(0, Math.min(Math.trunc(args.targetIndex), rows.length))
    rows.splice(targetIndex, 0, access.task)
    const now = Date.now()
    for (const [index, task] of rows.entries()) {
      await ctx.db.patch(task._id, {
        boardId: board._id, workflowStateId: state._id, rank: rankForIndex(index),
        terminalAt: isTerminalTaskState(state.category) ? task.terminalAt ?? now : undefined,
        revision: task._id === access.task._id ? task.revision + 1 : task.revision,
        updatedAt: now,
      })
    }
    if (access.task.parentTaskId === undefined && board._id !== access.task.boardId) {
      const subtasks = await ctx.db.query('tasks').withIndex('by_parent', (q) => q.eq('parentTaskId', access.task._id)).collect()
      const defaultState = await getDefaultWorkflowState(ctx, board._id)
      for (const subtask of subtasks) {
        const updatedSubtask = {
          ...subtask,
          boardId: board._id, workflowStateId: defaultState._id,
          terminalAt: undefined, revision: subtask.revision + 1, updatedAt: now,
        }
        await ctx.db.patch(subtask._id, {
          boardId: updatedSubtask.boardId,
          workflowStateId: updatedSubtask.workflowStateId,
          terminalAt: updatedSubtask.terminalAt,
          revision: updatedSubtask.revision,
          updatedAt: updatedSubtask.updatedAt,
        })
        await rescheduleTaskReminders(ctx, updatedSubtask)
      }
    }
    const updated = await ctx.db.get(access.task._id)
    if (!updated) throw new Error('task_access_changed')
    if (board._id !== access.task.boardId || state._id !== access.task.workflowStateId) {
      await appendTaskActivity(ctx, {
        task: updated, action: board._id !== access.task.boardId ? 'board_changed' : 'state_changed',
        actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
        before: { boardId: access.task.boardId, stateId: access.task.workflowStateId },
        after: { boardId: board._id, stateId: state._id },
      })
    }
    await rescheduleTaskReminders(ctx, updated)
    return await taskView(ctx, updated)
  },
})

export const setFollowing = mutation({
  args: { taskId: v.id('tasks'), enabled: v.boolean(), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canComment) throw new Error('task_access_changed')
    const existing = await ctx.db.query('taskFollowers').withIndex('by_task_member', (q) =>
      q.eq('taskId', access.task._id).eq('projectMemberId', access.projectMember._id),
    ).unique()
    const now = Date.now()
    if (existing) await ctx.db.patch(existing._id, { enabled: args.enabled, reason: 'explicit', updatedAt: now })
    else await ctx.db.insert('taskFollowers', {
      projectId: access.task.projectId, taskId: access.task._id, userId: actor.userId,
      projectMemberId: access.projectMember._id, reason: 'explicit', enabled: args.enabled,
      createdAt: now, updatedAt: now,
    })
    return args.enabled
  },
})

export const setArchived = mutation({
  args: { taskId: v.id('tasks'), archived: v.boolean(), restoreSubtasks: v.optional(v.boolean()), ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canArchive) throw new Error('task_archive_forbidden')
    const now = Date.now()
    const archivedAt = args.archived ? access.task.archivedAt ?? now : undefined
    await ctx.db.patch(access.task._id, { archivedAt, revision: access.task.revision + 1, updatedAt: now })
    if (!access.task.parentTaskId && (args.archived || args.restoreSubtasks)) {
      const subtasks = await ctx.db.query('tasks').withIndex('by_parent', (q) => q.eq('parentTaskId', access.task._id)).collect()
      for (const subtask of subtasks) {
        await ctx.db.patch(subtask._id, { archivedAt, revision: subtask.revision + 1, updatedAt: now })
        const updatedSubtask = await ctx.db.get(subtask._id)
        if (updatedSubtask) await rescheduleTaskReminders(ctx, updatedSubtask)
      }
    }
    const updated = await ctx.db.get(access.task._id)
    if (!updated) throw new Error('task_access_changed')
    await appendTaskActivity(ctx, {
      task: updated, action: args.archived ? 'archived' : 'restored',
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.actingCompanyId,
    })
    await rescheduleTaskReminders(ctx, updated)
    return updated.revision
  },
})

export const changeScope = mutation({
  args: {
    taskId: v.id('tasks'),
    destinationBoardId: v.id('taskBoards'),
    declassificationConfirmed: v.optional(v.boolean()),
    audienceReductionConfirmed: v.optional(v.boolean()),
    ...identityArgs,
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireTaskAccess(ctx, actor, args.taskId, args)
    if (!access.taskCapabilities.canChangeScope || access.task.parentTaskId) {
      throw new Error('task_scope_change_forbidden')
    }
    const destination = await ctx.db.get(args.destinationBoardId)
    if (!destination || destination.archivedAt || destination.projectId !== access.task.projectId ||
      destination.groupId === access.task.groupId) throw new Error('task_destination_invalid')
    const destinationAccess = await resolveTaskRequestContext(
      ctx, actor, access.task.projectId, args, destination.groupId,
    )
    if (destination.groupId && !destinationAccess.capabilities.canReadChannel) {
      throw new Error('task_destination_invalid')
    }
    if (access.task.groupId && !destination.groupId && !args.declassificationConfirmed) {
      throw new Error('task_declassification_confirmation_required')
    }
    if (!access.task.groupId && destination.groupId && !args.audienceReductionConfirmed) {
      throw new Error('task_audience_reduction_confirmation_required')
    }
    const destinationState = await getDefaultWorkflowState(ctx, destination._id)
    const affected = [
      access.task,
      ...await ctx.db.query('tasks').withIndex('by_parent', (q) => q.eq('parentTaskId', access.task._id)).collect(),
    ]
    const now = Date.now()
    for (const task of affected) {
      let assigneeProjectMemberId = task.assigneeProjectMemberId
      if (destination.groupId && assigneeProjectMemberId) {
        try {
          await requireEligibleTaskMember(ctx, {
            projectId: task.projectId,
            groupId: destination.groupId,
            projectMemberId: assigneeProjectMemberId,
          })
        } catch {
          assigneeProjectMemberId = undefined
        }
      }
      await ctx.db.patch(task._id, {
        boardId: destination._id,
        groupId: destination.groupId,
        workflowStateId: destinationState._id,
        assigneeProjectMemberId,
        terminalAt: undefined,
        revision: task.revision + 1,
        updatedAt: now,
      })
      const followers = await ctx.db.query('taskFollowers')
        .withIndex('by_task_enabled', (q) => q.eq('taskId', task._id).eq('enabled', true)).collect()
      if (destination.groupId) {
        for (const follower of followers) {
          try {
            await requireEligibleTaskMember(ctx, {
              projectId: task.projectId,
              groupId: destination.groupId,
              projectMemberId: follower.projectMemberId,
            })
          } catch {
            await ctx.db.patch(follower._id, { enabled: false, updatedAt: now })
          }
        }
      }
      await ctx.db.insert('taskActivities', {
        projectId: task.projectId,
        taskId: task._id,
        originalGroupId: task.groupId,
        actorProjectMemberId: access.projectMember._id,
        actingCompanyId: access.actingCompanyId,
        action: 'scope_changed',
        before: { boardId: task.boardId, groupId: task.groupId },
        after: { boardId: destination._id, groupId: destination.groupId },
        correlationId: `scope:${access.task._id}:${now}`,
        createdAt: now,
      })
    }
    await appendAuditEvent(ctx, {
      projectId: access.task.projectId,
      groupId: access.task.groupId,
      actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id,
      actingCompanyId: access.actingCompanyId,
      entityType: 'task',
      entityId: String(access.task._id),
      action: 'scope_changed',
      before: { groupId: access.task.groupId },
      after: { groupId: destination.groupId },
    })
    return access.task.revision + 1
  },
})

export const invalidateReferences = internalMutation({
  args: {
    messageId: v.optional(v.id('messages')),
    attachmentId: v.optional(v.id('attachments')),
    assistantStreamId: v.optional(v.id('assistantStreams')),
    redacted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await invalidateTaskEvidence(ctx, args)
  },
})
