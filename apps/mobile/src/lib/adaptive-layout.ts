export const CompactListRowWidth = 340;

/** Zero is the pre-layout sentinel and must retain the normal row geometry. */
export function isCompactListRow(width: number) {
  return Number.isFinite(width) && width > 0 && width < CompactListRowWidth;
}
