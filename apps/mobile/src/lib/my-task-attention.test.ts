import { describe, expect, it } from 'vitest';

import { myTaskAttentionItems } from './my-task-attention';

const item = (id: string, priority: string, dueDate?: string, category = 'started', updatedAt = 1) => ({
  id,
  state: { category },
  task: { dueDate, priority, updatedAt },
});

describe('My Tasks attention items', () => {
  it('ranks overdue and urgent work first, excludes terminal tasks, caps results, and preserves input', () => {
    const tasks = [
      item('medium-overdue', 'medium', '2026-09-30'),
      item('high', 'high', '2026-10-03'),
      item('completed', 'urgent', '2026-09-01', 'completed'),
      item('urgent-overdue', 'urgent', '2026-09-29'),
      item('canceled', 'urgent', undefined, 'canceled'),
      item('urgent', 'urgent', '2026-10-04'),
      item('normal-overdue', 'low', '2026-09-30'),
    ];
    const original = [...tasks];

    expect(myTaskAttentionItems(tasks, '2026-10-01').map(({ id }) => id)).toEqual([
      'urgent-overdue', 'medium-overdue', 'normal-overdue', 'urgent',
    ]);
    expect(myTaskAttentionItems(tasks, '2026-10-01', 2).map(({ id }) => id)).toEqual(['urgent-overdue', 'medium-overdue']);
    expect(tasks).toEqual(original);
  });
});
