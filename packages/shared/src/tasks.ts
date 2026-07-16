export const taskScopeKinds = ['project', 'channel'] as const
export type TaskScopeKind = (typeof taskScopeKinds)[number]

export const taskStateCategories = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const
export type TaskStateCategory = (typeof taskStateCategories)[number]

export const taskPriorities = ['none', 'urgent', 'high', 'medium', 'low'] as const
export type TaskPriority = (typeof taskPriorities)[number]

export const taskReferenceTypes = [
  'message',
  'attachment',
  'assistant_answer',
  'memory_excerpt',
] as const
export type TaskReferenceType = (typeof taskReferenceTypes)[number]

export const taskReferenceAvailability = ['available', 'unavailable', 'redacted'] as const
export type TaskReferenceAvailability = (typeof taskReferenceAvailability)[number]

export const taskSuggestionStatuses = ['pending', 'accepted', 'linked', 'dismissed'] as const
export type TaskSuggestionStatus = (typeof taskSuggestionStatuses)[number]

export const taskSuggestionDismissalReasons = [
  'not_actionable',
  'duplicate',
  'wrong_details',
  'sensitive',
  'other',
] as const
export type TaskSuggestionDismissalReason =
  (typeof taskSuggestionDismissalReasons)[number]

export const taskFollowerReasons = ['creator', 'assignee', 'commenter', 'explicit'] as const
export type TaskFollowerReason = (typeof taskFollowerReasons)[number]

export const taskNotificationModes = ['important', 'all_followed', 'muted'] as const
export type TaskNotificationMode = (typeof taskNotificationModes)[number]

export const taskReminderKinds = ['due_soon', 'overdue'] as const
export type TaskReminderKind = (typeof taskReminderKinds)[number]

export const taskJobStatuses = ['queued', 'running', 'completed', 'failed', 'canceled'] as const
export type TaskJobStatus = (typeof taskJobStatuses)[number]

export function isTerminalTaskState(category: TaskStateCategory) {
  return category === 'completed' || category === 'canceled'
}

const taskDueDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function isTaskDueDate(value: string) {
  if (!taskDueDatePattern.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}
