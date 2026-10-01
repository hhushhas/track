export type BoardTaskCountBadge = { accessibilityLabel: string; text: string };

/** Shows a lower-bound badge only when at least one assigned task is loaded. */
export function boardTaskCountBadge(count: number, partial: boolean): BoardTaskCountBadge | null {
  if (count <= 0) return null;
  const text = count > 99 ? '99+' : `${count}${partial ? '+' : ''}`;
  const countLabel = count > 99 ? '99 or more' : partial ? `${count} or more` : String(count);
  return {
    accessibilityLabel: `${countLabel} assigned ${count === 1 ? 'task' : 'tasks'}`,
    text,
  };
}
