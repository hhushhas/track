import { describe, expect, it } from 'vitest';

import type { MobileAttentionItem } from '@/lib/mobile-attention';
import { attentionMatchesHomeFilter, localDateKey, summarizeCommittedWork, taskIsDueToday, todayTaskPreview } from './home-feed';

function message(eventType: 'mention' | 'direct_reply' | 'discussion') {
  return { kind: 'message', eventType } as MobileAttentionItem;
}

describe('Home feed', () => {
  it('keeps direct conversation events in the Mentions filter', () => {
    expect(attentionMatchesHomeFilter(message('mention'), 'mentions')).toBe(true);
    expect(attentionMatchesHomeFilter(message('direct_reply'), 'mentions')).toBe(true);
    expect(attentionMatchesHomeFilter(message('discussion'), 'mentions')).toBe(false);
  });

  it('does not treat reminder delivery dates as task due dates', () => {
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'due_soon' } as MobileAttentionItem, 'due')).toBe(false);
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'overdue' } as MobileAttentionItem, 'due')).toBe(false);
  });

  it('separates assigned and suggested work', () => {
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'assignment' } as MobileAttentionItem, 'assigned')).toBe(true);
    expect(attentionMatchesHomeFilter({ kind: 'suggestion' } as MobileAttentionItem, 'suggestions')).toBe(true);
  });

  it('compares task dates in the device calendar day', () => {
    const now = new Date(2026, 8, 12, 23, 30);
    expect(taskIsDueToday('2026-09-12', now)).toBe(true);
    expect(taskIsDueToday('2026-09-13', now)).toBe(false);
    expect(taskIsDueToday(undefined, now)).toBe(false);
  });

  it('calculates personal committed work without canceled tasks', () => {
    const tasks = [
      { state: { category: 'completed' as const }, task: { priority: 'medium' as const, updatedAt: 1 } },
      { state: { category: 'unstarted' as const }, task: { dueDate: '2026-09-18', priority: 'high' as const, updatedAt: 2 } },
      { state: { category: 'started' as const }, task: { dueDate: '2026-09-17', priority: 'low' as const, updatedAt: 3 } },
      { state: { category: 'canceled' as const }, task: { priority: 'urgent' as const, updatedAt: 4 } },
    ];

    expect(summarizeCommittedWork(tasks, '2026-09-18')).toEqual({ completed: 1, dueToday: 1, overdue: 1, percent: 33, total: 3 });
  });

  it('puts overdue and high-priority work first and caps Today at four', () => {
    const tasks = [
      ['today-low', '2026-09-18', 'low'],
      ['overdue-low', '2026-09-17', 'low'],
      ['today-high', '2026-09-18', 'high'],
      ['today-medium', '2026-09-18', 'medium'],
      ['today-urgent', '2026-09-18', 'urgent'],
    ].map(([id, dueDate, priority], updatedAt) => ({
      id,
      state: { category: 'unstarted' as const },
      task: { dueDate, priority: priority as 'urgent' | 'high' | 'medium' | 'low', updatedAt },
    }));

    expect(todayTaskPreview(tasks, '2026-09-18').map((task) => task.id))
      .toEqual(['overdue-low', 'today-urgent', 'today-high', 'today-medium']);
  });

  it('uses the saved timezone for the Home calendar key', () => {
    const instant = new Date('2026-09-18T01:00:00.000Z');
    expect(localDateKey(instant, 'America/Los_Angeles')).toBe('2026-09-17');
    expect(localDateKey(instant, 'Asia/Karachi')).toBe('2026-09-18');
  });
});
