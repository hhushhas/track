import type { TaskPriority } from '@track/shared/tasks'

import type { Id } from '../../../../../convex/_generated/dataModel'

export type TaskDraft = {
  assigneeId: Id<'projectMembers'> | ''
  description: string
  dueDate: string
  priority: TaskPriority
  stateId: Id<'taskWorkflowStates'> | ''
  title: string
}

export type TaskDraftField = keyof TaskDraft

export type TaskDraftReconciliation = {
  baseline: TaskDraft
  conflictFields: ReadonlyArray<TaskDraftField>
  draft: TaskDraft
  remoteChangedFields: ReadonlyArray<TaskDraftField>
}

const draftFields: ReadonlyArray<TaskDraftField> = [
  'title',
  'description',
  'priority',
  'dueDate',
  'stateId',
  'assigneeId',
]

function copyField(target: TaskDraft, source: TaskDraft, field: TaskDraftField) {
  switch (field) {
    case 'title':
      target.title = source.title
      return
    case 'description':
      target.description = source.description
      return
    case 'priority':
      target.priority = source.priority
      return
    case 'dueDate':
      target.dueDate = source.dueDate
      return
    case 'stateId':
      target.stateId = source.stateId
      return
    case 'assigneeId':
      target.assigneeId = source.assigneeId
      return
  }
}

export function taskDraftEquals(left: TaskDraft, right: TaskDraft) {
  return draftFields.every((field) => left[field] === right[field])
}

export function taskDraftDirtyFields(draft: TaskDraft, baseline: TaskDraft) {
  return draftFields.filter((field) => draft[field] !== baseline[field])
}

/**
 * Reconciles a reactive task projection without replacing fields the user has
 * changed locally. A conflict is limited to fields changed by both actors;
 * unrelated server fields can continue flowing into the draft.
 */
export function reconcileTaskDraft({
  baseline,
  draft,
  nextServer,
  previousServer,
}: {
  baseline: TaskDraft
  draft: TaskDraft
  nextServer: TaskDraft
  previousServer: TaskDraft
}): TaskDraftReconciliation {
  const dirtyFields = new Set(taskDraftDirtyFields(draft, baseline))
  const remoteChangedFields = draftFields.filter((field) => previousServer[field] !== nextServer[field])
  const conflictFields = remoteChangedFields.filter((field) => dirtyFields.has(field))
  const nextDraft = { ...draft }
  const nextBaseline = { ...baseline }

  for (const field of remoteChangedFields) {
    if (dirtyFields.has(field)) continue
    copyField(nextDraft, nextServer, field)
    copyField(nextBaseline, nextServer, field)
  }

  return {
    baseline: nextBaseline,
    conflictFields,
    draft: nextDraft,
    remoteChangedFields,
  }
}
