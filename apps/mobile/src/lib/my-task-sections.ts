export type MyTaskSectionKey = 'overdue' | 'today' | 'upcoming' | 'unscheduled' | 'completed';

export type SectionableTask = {
  state?: { category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' } | null;
  task: { dueDate?: string; updatedAt: number };
};

export type MyTaskSection<T> = {
  data: T[];
  key: MyTaskSectionKey;
  title: string;
};

function byDueDate<T extends SectionableTask>(left: T, right: T) {
  return (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31')
    || right.task.updatedAt - left.task.updatedAt;
}

/** Mobile task groups are decision groups, not reporting buckets. */
export function buildMyTaskSections<T extends SectionableTask>(tasks: readonly T[], today: string): MyTaskSection<T>[] {
  const open = tasks.filter((item) => item.state?.category !== 'completed' && item.state?.category !== 'canceled');
  const sections: MyTaskSection<T>[] = [
    {
      data: open.filter((item) => item.task.dueDate && item.task.dueDate < today).sort(byDueDate),
      key: 'overdue',
      title: 'Overdue',
    },
    {
      data: open.filter((item) => item.task.dueDate === today).sort(byDueDate),
      key: 'today',
      title: 'Due today',
    },
    {
      data: open.filter((item) => item.task.dueDate && item.task.dueDate > today).sort(byDueDate),
      key: 'upcoming',
      title: 'Upcoming',
    },
    {
      data: open.filter((item) => !item.task.dueDate).sort(byDueDate),
      key: 'unscheduled',
      title: 'Unscheduled',
    },
    {
      data: tasks
        .filter((item) => item.state?.category === 'completed')
        .sort((left, right) => right.task.updatedAt - left.task.updatedAt),
      key: 'completed',
      title: 'Completed',
    },
  ];
  return sections.filter((section) => section.data.length > 0);
}
