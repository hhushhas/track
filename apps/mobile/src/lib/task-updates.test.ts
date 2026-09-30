import { describe, expect, it } from 'vitest';

import { formatTaskUpdateDate, mergeTaskUpdates, taskUpdateDayLabel, visibleTaskUpdates } from './task-updates';

describe('task update history', () => {
  it('presents stored due dates as readable dates in activity', () => {
    expect(formatTaskUpdateDate('2026-09-24')).toMatch(/Sep.*24.*2026/);
    expect(formatTaskUpdateDate('not-a-date')).toBe('not-a-date');
  });
  it('interleaves comments and changes oldest first without duplicate comment events', () => {
    const updates = mergeTaskUpdates(
      [
        { _id: 'old-comment', createdAt: 1 },
        { _id: 'new-comment', createdAt: 4 },
        { _id: 'new-comment', createdAt: 4 },
        { _id: 'removed', createdAt: 5, archivedAt: 6 },
      ],
      [
        { _id: 'created', createdAt: 0, action: 'created' },
        { _id: 'comment-event', createdAt: 4, action: 'commented' },
        { _id: 'status', createdAt: 3, action: 'state_changed' },
      ],
    );

    expect(updates.map(({ kind, item }) => `${kind}:${item._id}`)).toEqual([
      'activity:created',
      'comment:old-comment',
      'activity:status',
      'comment:new-comment',
    ]);
  });

  it('uses stable ordering when two changes have the same timestamp', () => {
    const updates = mergeTaskUpdates(
      [{ _id: 'comment', createdAt: 10 }],
      [{ _id: 'z', createdAt: 10, action: 'created' }, { _id: 'a', createdAt: 10, action: 'state_changed' }],
    );
    expect(updates.map(({ item }) => item._id)).toEqual(['comment', 'a', 'z']);
  });

  it('keeps chronology stable when comments and changes load separate older pages', () => {
    const comments = [{ _id: 'new-comment', createdAt: 8 }, { _id: 'old-comment', createdAt: 2 }];
    const activities = [{ _id: 'new-change', createdAt: 9, action: 'state_changed' }, { _id: 'old-change', createdAt: 4, action: 'due_date_changed' }];
    expect(mergeTaskUpdates(comments.slice(0, 1), activities.slice(0, 1)).map(({ item }) => item._id))
      .toEqual(['new-comment', 'new-change']);
    expect(mergeTaskUpdates(comments, activities.slice(0, 1)).map(({ item }) => item._id))
      .toEqual(['old-comment', 'new-comment', 'new-change']);
    expect(mergeTaskUpdates(comments, activities).map(({ item }) => item._id))
      .toEqual(['old-comment', 'old-change', 'new-comment', 'new-change']);
  });

  it('does not show an incomplete interval between separate page cursors', () => {
    const comments = [{ _id: 'c9', createdAt: 9 }, { _id: 'c5', createdAt: 5 }];
    const activities = [{ _id: 'a8', createdAt: 8, action: 'state_changed' }, { _id: 'a7', createdAt: 7, action: 'created' }];
    expect(visibleTaskUpdates(comments, activities, true, true).map(({ item }) => item._id)).toEqual(['a8', 'c9']);
    expect(visibleTaskUpdates(comments, activities, false, false).map(({ item }) => item._id)).toEqual(['c5', 'a7', 'a8', 'c9']);
  });

  it('groups dates in the reader’s locale without relying on UTC midnight', () => {
    const now = new Date(2026, 8, 24, 12).getTime();
    expect(taskUpdateDayLabel(now, now)).toBe('Today');
    expect(taskUpdateDayLabel(new Date(2026, 8, 23, 12).getTime(), now)).toBe('Yesterday');
  });
});
