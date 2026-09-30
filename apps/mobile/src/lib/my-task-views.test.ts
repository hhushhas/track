import { describe, expect, it } from 'vitest';

import { countMyTaskViews, scopeMyTaskItems, tasksForMyTaskView } from './my-task-views';

type Task = {
  id: string;
  state: { category: 'backlog' | 'started' | 'completed' | 'canceled' };
  task: { dueDate?: string; priority: 'urgent' | 'high' | 'low' };
};

const items: Task[] = [
  { id: 'overdue-urgent', state: { category: 'started' }, task: { dueDate: '2026-09-28', priority: 'urgent' } },
  { id: 'today-urgent', state: { category: 'backlog' }, task: { dueDate: '2026-09-30', priority: 'urgent' } },
  { id: 'today-normal', state: { category: 'started' }, task: { dueDate: '2026-09-30', priority: 'high' } },
  { id: 'future-urgent', state: { category: 'started' }, task: { dueDate: '2026-10-01', priority: 'urgent' } },
  { id: 'future-normal', state: { category: 'started' }, task: { dueDate: '2026-10-01', priority: 'low' } },
  { id: 'done-urgent', state: { category: 'completed' }, task: { dueDate: '2026-09-30', priority: 'urgent' } },
  { id: 'canceled-urgent', state: { category: 'canceled' }, task: { dueDate: '2026-09-30', priority: 'urgent' } },
];
const statusFilteredItems = items.filter(({ state }) => state.category !== 'canceled');

describe('My Tasks views', () => {
  it('limits assigned task views to the selected Project and restores all Projects when cleared', () => {
    const projectItems = [
      { id: 'one', project: { _id: 'project-one' } },
      { id: 'two', project: { _id: 'project-two' } },
    ];
    expect(scopeMyTaskItems(projectItems, 'project-two').map(({ id }) => id)).toEqual(['two']);
    expect(scopeMyTaskItems(projectItems, null)).toEqual(projectItems);
  });

  it('keeps Today urgent-only and Upcoming available for every priority', () => {
    expect(tasksForMyTaskView(statusFilteredItems, 'today', '2026-09-30', null, 'all').map(({ id }) => id))
      .toEqual(['overdue-urgent', 'today-urgent']);
    expect(tasksForMyTaskView(statusFilteredItems, 'upcoming', '2026-09-30', null, 'all').map(({ id }) => id))
      .toEqual(['future-urgent', 'future-normal']);
  });

  it('keeps completed work in All and isolates it in Done', () => {
    expect(tasksForMyTaskView(statusFilteredItems, 'all', '2026-09-30', null, 'all').map(({ id }) => id))
      .toContain('done-urgent');
    expect(tasksForMyTaskView(statusFilteredItems, 'done', '2026-09-30', null, 'all').map(({ id }) => id))
      .toEqual(['done-urgent']);
  });

  it('keeps selected-day rows and all four view counts on the same date and urgency scope', () => {
    expect(tasksForMyTaskView(statusFilteredItems, 'all', '2026-09-30', '2026-09-30', 'all').map(({ id }) => id))
      .toEqual(['today-urgent', 'done-urgent']);
    expect(countMyTaskViews(statusFilteredItems, '2026-09-30', '2026-09-30', 'all'))
      .toEqual({ all: 2, done: 1, today: 1, upcoming: 0 });
  });

  it('includes completed tasks in Done counts only when the selected date matches', () => {
    expect(countMyTaskViews(statusFilteredItems, '2026-09-30', null, 'all').done).toBe(1);
    expect(countMyTaskViews(statusFilteredItems, '2026-09-30', '2026-10-01', 'all').done).toBe(0);
  });
});
