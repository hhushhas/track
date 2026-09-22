import type { IconName } from '@/components/platform-icon';

export type PrimaryDestination = {
  key: 'home' | 'inbox' | 'tasks' | 'team';
  label: string;
  icon: IconName;
  disabled?: boolean;
};

export type PrimaryTabGeometry = {
  cellWidth: number;
  indicatorLeft: number;
  indicatorWidth: number;
};

const immersiveRouteNames = new Set(['conversation', 'task', 'thread']);

/**
 * Conversation, thread, and task detail are focused work destinations. Their
 * composers and detail controls own the bottom edge, so the global app bar
 * must not compete with them or cover their final interactive row.
 */
export function primaryNavigationVisibleForPath(pathname: string) {
  const routeName = pathname.split('?')[0]?.split('/').filter(Boolean).at(-1);
  return routeName ? !immersiveRouteNames.has(routeName) : true;
}

/** Accessibility text may use two lines, so the floating shell grows with it. */
export function primaryNavigationHeight(fontScale: number, baseHeight: number) {
  return baseHeight + (Number.isFinite(fontScale) && fontScale > 1.2 ? 32 : 0);
}

/** Keeps the selection pill and tab content on the same cell centers. */
export function primaryTabGeometry(rowWidth: number, tabCount: number, tabIndex: number): PrimaryTabGeometry {
  const safeCount = Math.max(1, tabCount);
  const safeIndex = Math.min(Math.max(tabIndex, 0), safeCount - 1);
  const cellWidth = rowWidth / safeCount;
  const indicatorWidth = Math.min(44, Math.max(40, cellWidth - 12));
  return {
    cellWidth,
    indicatorLeft: safeIndex * cellWidth + (cellWidth - indicatorWidth) / 2,
    indicatorWidth,
  };
}

/** Resolves a finger position to the nearest valid primary destination. */
export function primaryTabIndexAtX(x: number, rowWidth: number, tabCount: number) {
  const safeCount = Math.max(1, tabCount);
  if (rowWidth <= 0) return 0;
  return Math.min(Math.max(Math.floor(x / (rowWidth / safeCount)), 0), safeCount - 1);
}

/** Maps the five physical slots around the center Create button to four tabs. */
export function primaryDestinationIndexAtX(x: number, rowWidth: number) {
  'worklet';
  if (rowWidth <= 0) return 0;
  const slot = Math.min(4, Math.max(0, Math.floor(x / (rowWidth / 5))));
  if (slot < 2) return slot;
  if (slot > 2) return slot - 1;
  return x < rowWidth / 2 ? 1 : 2;
}

/**
 * Preserves direct finger tracking inside a bound, then progressively resists
 * travel outside it. The hard overshoot keeps the liquid pill inside the
 * physical display while still allowing it to visibly escape the glass bar.
 */
export function primaryTabRubberBand(
  value: number,
  minimum: number,
  maximum: number,
  maximumOvershoot: number,
) {
  'worklet';
  if (value < minimum) {
    return Math.max(minimum - maximumOvershoot, minimum + (value - minimum) * 0.28);
  }
  if (value > maximum) {
    return Math.min(maximum + maximumOvershoot, maximum + (value - maximum) * 0.28);
  }
  return value;
}

/** A primary Tasks press always means global My Tasks, never retained Project scope. */
export function primaryTabResetTarget(key: PrimaryDestination['key']) {
  return key === 'tasks' ? { params: {}, screen: 'tasks' } as const : null;
}

export function primaryDestinationForRoute(routeName: string, tasksDisabled = false): PrimaryDestination {
  if (routeName === '(home)') return { key: 'home', label: 'Home', icon: 'home' };
  if (routeName === '(inbox)') return { key: 'inbox', label: 'Inbox', icon: 'email-outline' };
  if (routeName === '(tasks)') return { key: 'tasks', label: 'My Tasks', icon: 'task', disabled: tasksDisabled };
  if (routeName === '(team)') return { key: 'team', label: 'Team', icon: 'account-group' };
  throw new Error(`Unsupported primary tab route: ${routeName}`);
}
