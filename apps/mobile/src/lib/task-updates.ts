type DatedRecord = { _id: string; createdAt: number };
type CommentRecord = DatedRecord & { archivedAt?: number };
type ActivityRecord = DatedRecord & { action: string };

export function formatTaskUpdateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One chronological task history, without a second event for each comment. */
export function mergeTaskUpdates<C extends CommentRecord, A extends ActivityRecord>(
  comments: readonly C[],
  activities: readonly A[],
): Array<{ kind: 'comment'; item: C } | { kind: 'activity'; item: A }> {
  const seenComments = new Set<string>();
  const seenActivities = new Set<string>();
  const updates: Array<{ kind: 'comment'; item: C } | { kind: 'activity'; item: A }> = [];
  for (const item of comments) {
    if (item.archivedAt || seenComments.has(item._id)) continue;
    seenComments.add(item._id);
    updates.push({ kind: 'comment', item });
  }
  for (const item of activities) {
    if (item.action === 'commented' || seenActivities.has(item._id)) continue;
    seenActivities.add(item._id);
    updates.push({ kind: 'activity', item });
  }
  return updates.sort((left, right) =>
    left.item.createdAt - right.item.createdAt ||
    (left.kind === right.kind ? 0 : left.kind === 'comment' ? -1 : 1) ||
    left.item._id.localeCompare(right.item._id));
}

/** Separate descending pages can be interleaved safely only above both cursors. */
export function visibleTaskUpdates<C extends CommentRecord, A extends ActivityRecord>(
  comments: readonly C[], activities: readonly A[],
  moreComments: boolean, moreActivities: boolean,
) {
  const boundaries = [
    moreComments ? comments.at(-1)?.createdAt : undefined,
    moreActivities ? activities.at(-1)?.createdAt : undefined,
  ].filter((value): value is number => value !== undefined);
  const oldestSafeTimestamp = boundaries.length ? Math.max(...boundaries) : -Infinity;
  return mergeTaskUpdates(comments, activities).filter(({ item }) => item.createdAt > oldestSafeTimestamp);
}

export function taskUpdateDayLabel(timestamp: number, now: number = Date.now()): string {
  const day = new Date(timestamp);
  const today = new Date(now);
  if (day.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
