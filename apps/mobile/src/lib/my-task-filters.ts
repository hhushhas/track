export type MyTaskFilter = 'all' | 'open' | 'completed' | 'high';

export type MyTaskStatusFilter = 'all' | 'open' | 'completed' | 'canceled';
export type MyTaskPriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type MyTaskDueFilter = 'all' | 'overdue' | 'today' | 'thisWeek' | 'later' | 'unscheduled';
export type MyTaskFilters = {
  dueDate: MyTaskDueFilter;
  priority: MyTaskPriorityFilter;
  status: MyTaskStatusFilter;
};

type FilterableTask = {
  group?: { name: string } | null;
  project: { name: string };
  state?: { category: string } | null;
  task: { priority: string; publicKey: string; title: string };
};

export function matchesMyTaskSearch(item: FilterableTask, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [item.task.title, item.task.publicKey, item.project.name, item.group?.name]
    .some((value) => value?.toLocaleLowerCase().includes(normalized));
}

export function matchesMyTaskFilter(item: FilterableTask, filter: MyTaskFilter) {
  if (filter === 'all') return item.state?.category !== 'canceled';
  if (filter === 'completed') return item.state?.category === 'completed';
  if (filter === 'high') return item.state?.category !== 'canceled' && (item.task.priority === 'urgent' || item.task.priority === 'high');
  return item.state?.category !== 'completed' && item.state?.category !== 'canceled';
}

export function matchesMyTaskFilters(item: FilterableTask & { task: FilterableTask['task'] & { dueDate?: string } }, filters: MyTaskFilters, today: string, weekEnd: string) {
  const category = item.state?.category;
  const dueDate = item.task.dueDate;

  const matchesStatus = filters.status === 'all'
    ? category !== 'canceled'
    : filters.status === 'open'
      ? category !== 'completed' && category !== 'canceled'
      : filters.status === 'completed'
        ? category === 'completed'
        : category === 'canceled';
  if (!matchesStatus) return false;

  if (filters.priority !== 'all' && item.task.priority !== filters.priority) return false;

  switch (filters.dueDate) {
    case 'overdue': return Boolean(dueDate && dueDate < today);
    case 'today': return dueDate === today;
    case 'thisWeek': return Boolean(dueDate && dueDate >= today && dueDate <= weekEnd);
    case 'later': return Boolean(dueDate && dueDate > weekEnd);
    case 'unscheduled': return !dueDate;
    default: return true;
  }
}
