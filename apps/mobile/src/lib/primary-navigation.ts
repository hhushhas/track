import type { IconName } from '@/components/platform-icon';

export type PrimaryDestination = {
  key: 'evidence' | 'home' | 'projects' | 'tasks';
  label: string;
  icon: IconName;
  disabled?: boolean;
};

export type PrimaryTabGeometry = {
  cellWidth: number;
  indicatorLeft: number;
  indicatorWidth: number;
};

/** Keeps the selection pill and tab content on the same cell centers. */
export function primaryTabGeometry(rowWidth: number, tabCount: number, tabIndex: number): PrimaryTabGeometry {
  const safeCount = Math.max(1, tabCount);
  const safeIndex = Math.min(Math.max(tabIndex, 0), safeCount - 1);
  const cellWidth = rowWidth / safeCount;
  const indicatorWidth = Math.max(48, cellWidth - 8);
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
  if (routeName === '(home)') return { key: 'home', label: 'Home', icon: 'inbox' };
  if (routeName === '(projects)') return { key: 'projects', label: 'Projects', icon: 'briefcase-outline' };
  if (routeName === '(tasks)') return { key: 'tasks', label: 'Tasks', icon: 'check-circle', disabled: tasksDisabled };
  if (routeName === '(search)') return { key: 'evidence', label: 'Evidence', icon: 'file-document-outline' };
  throw new Error(`Unsupported primary tab route: ${routeName}`);
}
