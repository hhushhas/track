import { describe, expect, it } from 'vitest';

import { needsAttention, tasksForWeekDay, weekDateKeys } from './task-week';

describe('weekDateKeys', () => {
  it('returns the complete Monday to Sunday week containing the selected day', () => {
    expect(weekDateKeys('2026-09-23')).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ]);
    expect(weekDateKeys('2027-01-01')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });
});

describe('task week selections', () => {
  const tasks = [
    { task: { dueDate: '2026-09-23', priority: 'urgent' }, state: { category: 'started' } },
    { task: { dueDate: '2026-09-23', priority: 'high' }, state: { category: 'completed' } },
    { task: { dueDate: '2026-09-23', priority: 'high' }, state: { category: 'canceled' } },
    { task: { dueDate: '2026-09-20', priority: 'none' }, state: { category: 'unstarted' } },
  ];

  it('keeps completed work in the day view and excludes canceled work', () => {
    expect(tasksForWeekDay(tasks, '2026-09-23')).toHaveLength(2);
  });

  it('puts overdue and high-priority open work first in Attention Needed', () => {
    expect(needsAttention(tasks, '2026-09-23')).toEqual([tasks[3], tasks[0]]);
  });
});
