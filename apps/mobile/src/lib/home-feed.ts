import type { MobileAttentionItem } from '@/lib/mobile-attention';

export type HomeFilter = 'all' | 'mentions' | 'due' | 'assigned' | 'suggestions';

export function attentionMatchesHomeFilter(item: MobileAttentionItem, filter: HomeFilter) {
  if (filter === 'all') return true;
  if (filter === 'mentions') return item.eventType === 'mention' || item.eventType === 'direct_reply';
  // Reminder events describe when a notification was sent, not the task's due date.
  // Due Today is derived from the task record so the chip stays calendar-accurate.
  if (filter === 'due') return false;
  if (filter === 'assigned') return item.kind === 'task' && (item.eventType === 'assignment' || item.eventType === 'assignment_lost');
  return item.kind === 'suggestion';
}

export function taskIsDueToday(dueDate: string | undefined, now = new Date()) {
  if (!dueDate) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dueDate === today;
}

type HomeSummaryTask = {
  state?: { category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' } | null;
  task: {
    dueDate?: string;
    priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
    updatedAt: number;
  };
};

const priorityOrder: Record<HomeSummaryTask['task']['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/** Personal commitment progress excludes canceled work and never includes another assignee. */
export function summarizeCommittedWork<T extends HomeSummaryTask>(items: readonly T[], today: string) {
  const committed = items.filter((item) => item.state?.category !== 'canceled');
  const completed = committed.filter((item) => item.state?.category === 'completed').length;
  const open = committed.filter((item) => item.state?.category !== 'completed');
  return {
    completed,
    dueToday: open.filter((item) => item.task.dueDate === today).length,
    overdue: open.filter((item) => Boolean(item.task.dueDate && item.task.dueDate < today)).length,
    percent: committed.length ? Math.round((completed / committed.length) * 100) : 0,
    total: committed.length,
  };
}

/** Today is a bounded preview: overdue first, then priority, due date, and recency. */
export function todayTaskPreview<T extends HomeSummaryTask>(items: readonly T[], today: string, limit = 4) {
  return items
    .filter((item) => item.state?.category !== 'completed'
      && item.state?.category !== 'canceled'
      && Boolean(item.task.dueDate && item.task.dueDate <= today))
    .sort((left, right) => {
      const leftOverdue = left.task.dueDate! < today ? 0 : 1;
      const rightOverdue = right.task.dueDate! < today ? 0 : 1;
      return leftOverdue - rightOverdue
        || priorityOrder[left.task.priority] - priorityOrder[right.task.priority]
        || left.task.dueDate!.localeCompare(right.task.dueDate!)
        || right.task.updatedAt - left.task.updatedAt;
    })
    .slice(0, Math.max(0, limit));
}

export function localDateKey(date = new Date(), timeZone?: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
