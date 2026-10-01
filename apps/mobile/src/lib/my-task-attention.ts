type AttentionTask = {
  state?: { category?: string } | null;
  task: {
    dueDate?: string;
    priority: string;
    updatedAt: number;
  };
};

/** Selects a small, passive set of the most urgent open tasks for My Tasks. */
export function myTaskAttentionItems<T extends AttentionTask>(items: readonly T[], today: string, limit = 4): T[] {
  return items
    .filter((item) => item.state?.category !== 'completed' && item.state?.category !== 'canceled')
    .filter((item) => item.task.priority === 'urgent' || item.task.priority === 'high' || Boolean(item.task.dueDate && item.task.dueDate <= today))
    .slice()
    .sort((left, right) => {
      const priorityRank = (priority: string) => priority === 'urgent' ? 0 : priority === 'high' ? 1 : 2;
      const dueRank = (dueDate?: string) => dueDate && dueDate <= today ? 0 : 1;
      return dueRank(left.task.dueDate) - dueRank(right.task.dueDate)
        || priorityRank(left.task.priority) - priorityRank(right.task.priority)
        || (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31');
    })
    .slice(0, Math.max(0, limit));
}
