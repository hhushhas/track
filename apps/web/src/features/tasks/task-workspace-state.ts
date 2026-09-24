export type TaskWorkspaceView = 'board' | 'list' | 'calendar'

export function boardIdForTaskView<T extends string>(
  view: string,
  selectedBoardId: T | undefined,
) {
  return view === 'board' ? selectedBoardId : undefined
}

export function resolveWorkflowStateId<T extends string>(
  boards: ReadonlyArray<{ states: ReadonlyArray<{ _id: T }> }> | undefined,
  requestedStateId: string | undefined,
) {
  if (!requestedStateId) return undefined
  return boards
    ?.flatMap((board) => board.states)
    .find((state) => state._id === requestedStateId)?._id
}
