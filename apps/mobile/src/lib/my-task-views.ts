import type { MyTaskStatusFilter } from './my-task-filters';

export type MyTaskView = 'today' | 'upcoming' | 'all' | 'done';

type MyTaskViewItem = {
  state?: { category?: string } | null;
  task: { dueDate?: string; priority: string };
};

type MyTaskProjectItem = { project: { _id: unknown } };

/** Keeps every My Tasks surface on the same explicitly selected Project scope. */
export function scopeMyTaskItems<T extends MyTaskProjectItem>(items: readonly T[], projectId: string | null) {
  return projectId ? items.filter((item) => String(item.project._id) === projectId) : [...items];
}

/** Applies the four My Tasks views after search, Project, and sheet filters. */
export function tasksForMyTaskView<T extends MyTaskViewItem>(
  items: readonly T[],
  view: MyTaskView,
  today: string,
  selectedDate: string | null,
  statusFilter: MyTaskStatusFilter,
) {
  const scoped = selectedDate
    ? items.filter((item) => item.task.dueDate === selectedDate && item.task.priority === 'urgent')
    : items;

  if (view === 'done') return scoped.filter((item) => item.state?.category === 'completed');
  if (view === 'today') return scoped.filter((item) =>
    item.task.priority === 'urgent'
    && Boolean(item.task.dueDate && item.task.dueDate <= today)
    && (statusFilter !== 'all' || item.state?.category !== 'completed'),
  );
  if (view === 'upcoming') return scoped.filter((item) =>
    Boolean(item.task.dueDate && item.task.dueDate > today)
    && (statusFilter !== 'all' || item.state?.category !== 'completed'),
  );
  return scoped;
}

export function countMyTaskViews<T extends MyTaskViewItem>(
  items: readonly T[],
  today: string,
  selectedDate: string | null,
  statusFilter: MyTaskStatusFilter,
) {
  return {
    all: tasksForMyTaskView(items, 'all', today, selectedDate, statusFilter).length,
    done: tasksForMyTaskView(items, 'done', today, selectedDate, statusFilter).length,
    today: tasksForMyTaskView(items, 'today', today, selectedDate, statusFilter).length,
    upcoming: tasksForMyTaskView(items, 'upcoming', today, selectedDate, statusFilter).length,
  };
}
