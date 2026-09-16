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
