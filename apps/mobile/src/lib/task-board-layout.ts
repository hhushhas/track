/** Phones use one status column so horizontal board navigation never competes
 * with the vertical task list and long-press movement gesture. */
export const CompactBoardBreakpoint = 600;

export function isCompactTaskBoard(width: number) {
  return Number.isFinite(width) && width < CompactBoardBreakpoint;
}

/** Resolves the column closest to the viewport after a horizontal board gesture. */
export function taskBoardColumnIndex(offset: number, stride: number, columnCount: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(stride) || stride <= 0 || columnCount <= 0) return 0;
  return Math.min(columnCount - 1, Math.max(0, Math.round(offset / stride)));
}
