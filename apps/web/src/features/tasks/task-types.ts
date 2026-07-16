import type { Doc, Id } from '../../../../../convex/_generated/dataModel'

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
