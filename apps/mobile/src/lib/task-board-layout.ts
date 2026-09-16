/** Phones use one status column so horizontal board navigation never competes
 * with the vertical task list and long-press movement gesture. */
export const CompactBoardBreakpoint = 600;

export function isCompactTaskBoard(width: number) {
  return Number.isFinite(width) && width < CompactBoardBreakpoint;
}
