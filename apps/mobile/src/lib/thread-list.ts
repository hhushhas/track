/** Returns the date rows that should stay visible as chat messages scroll. */
export function stickyDateHeaderIndices(items: readonly { kind: string }[], hasListHeader = false): number[] {
  const headerOffset = hasListHeader ? 1 : 0;
  return items.flatMap((item, index) => item.kind === 'date-sep' ? [index + headerOffset] : []);
}

/** Shows the jump control only after the reader is far enough from the latest messages. */
export function shouldShowJumpToLatest(distanceFromBottom: number): boolean {
  return distanceFromBottom > 320;
}
