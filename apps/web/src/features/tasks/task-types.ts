import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import type { TaskCapabilities } from '@track/shared/tasks'

export type TaskIdentity = {
  actingCompanyId?: Id<'companies'>
  projectMemberId?: Id<'projectMembers'>
}

export type TaskBoardView = {
  board: Doc<'taskBoards'>
  states: Array<Doc<'taskWorkflowStates'>>
}

export type TaskView = {
  task: Doc<'tasks'>
  board: Doc<'taskBoards'> | null
  state: Doc<'taskWorkflowStates'> | null
  assignee: Doc<'projectMembers'> | null
  creator: Doc<'projectMembers'> | null
  labels: Array<Doc<'taskLabels'>>
  references: Array<Doc<'taskReferences'>>
  terminal: boolean
  capabilities?: TaskCapabilities
}

export function canManageTaskProject(role: Doc<'projectMembers'>['role'] | undefined) {
  return role === 'manager' || role === 'owner' || role === 'admin'
}

export function canEditTaskView(
  item: TaskView,
  currentProjectMemberId: Id<'projectMembers'> | undefined,
  currentProjectRole: Doc<'projectMembers'>['role'] | undefined,
) {
  if (item.capabilities) return item.capabilities.canEdit
  if (item.task.archivedAt || item.board?.archivedAt || !currentProjectMemberId) return false
  if (
    currentProjectRole === 'manager' ||
    currentProjectRole === 'owner' ||
    currentProjectRole === 'admin' ||
    currentProjectRole === 'staff'
  ) return true
  return item.task.createdByProjectMemberId === currentProjectMemberId ||
    item.task.assigneeProjectMemberId === currentProjectMemberId
}

export function taskIdentity(search: {
  actingCompanyId?: string
  projectMemberId?: string
}): TaskIdentity {
  if (!search.actingCompanyId || !search.projectMemberId) return {}
  return {
    actingCompanyId: search.actingCompanyId as Id<'companies'>,
    projectMemberId: search.projectMemberId as Id<'projectMembers'>,
  }
}

export function groupTaskViewsByState(
  states: ReadonlyArray<Doc<'taskWorkflowStates'>>,
  tasks: ReadonlyArray<TaskView>,
  optimisticStates: Readonly<Record<string, string>> = {},
) {
  return new Map(states.map((state) => [
    state._id,
    tasks.filter((item) =>
      (optimisticStates[item.task._id] ?? item.task.workflowStateId) === state._id,
    ).sort((left, right) => left.task.rank.localeCompare(right.task.rank)),
  ]))
}
