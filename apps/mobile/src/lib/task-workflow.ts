type WorkflowStateChoice = {
  _id: string;
  isDefault: boolean;
};

type BoardStateChoice = {
  _id: string;
};

type BoardColumnChoice = BoardStateChoice & {
  taskCount: number;
};

/** Keeps a valid choice, otherwise follows the board's configured default. */
export function resolveWorkflowStateId(
  states: WorkflowStateChoice[],
  current = '',
) {
  if (states.some((state) => state._id === current)) return current;
  return states.find((state) => state.isDefault)?._id ?? states[0]?._id ?? '';
}

/** A blank filter includes every status; otherwise only the exact workflow state matches. */
export function taskMatchesWorkflowStateFilter(
  workflowStateId: string,
  filterStateId: string,
) {
  return !filterStateId || workflowStateId === filterStateId;
}

/** Resolves phone-board paging without wrapping past either end of the workflow. */
export function adjacentBoardStateId(
  states: BoardStateChoice[],
  activeStateId: string,
  direction: -1 | 1,
) {
  const currentIndex = states.findIndex((state) => state._id === activeStateId);
  if (currentIndex < 0) return states[0]?._id ?? '';
  const nextIndex = Math.min(states.length - 1, Math.max(0, currentIndex + direction));
  return states[nextIndex]?._id ?? activeStateId;
}

/** Resolves a paged board's visible column and clamps scroll overshoot safely. */
export function boardPageIndex(offset: number, pageWidth: number, pageCount: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(pageWidth) || pageWidth <= 0 || pageCount <= 0) return 0;
  return Math.min(pageCount - 1, Math.max(0, Math.round(offset / pageWidth)));
}

/** Applies exact-status and hide-empty controls without silently restoring empty columns. */
export function visibleBoardStateIds(
  columns: BoardColumnChoice[],
  statusFilterId: string,
  hideEmpty: boolean,
) {
  const scoped = statusFilterId
    ? columns.filter((column) => column._id === statusFilterId)
    : columns;
  return (hideEmpty ? scoped.filter((column) => column.taskCount > 0) : scoped)
    .map((column) => column._id);
}
