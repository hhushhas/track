import { describe, expect, it } from 'vitest';

import { summarizeMyTaskCounts } from './my-task-counts';

const items = [
  { project: { _id: 'project-a' }, task: { boardId: 'board-a', dueDate: '2026-10-01' }, state: { category: 'started' }, hasMoreAssignedTasks: true },
  { project: { _id: 'project-a' }, task: { boardId: 'board-b', dueDate: '2026-10-10' }, state: { category: 'backlog' } },
  { project: { _id: 'project-a' }, task: { boardId: 'board-b', dueDate: '2026-09-30' }, state: { category: 'completed' } },
  { project: { _id: 'project-b' }, task: { boardId: 'board-c' }, state: { category: 'canceled' } },
];

describe('My Tasks project and Board counts', () => {
  it('counts assigned work by scope and only counts open work due through today', () => {
    const { byBoard, byProject } = summarizeMyTaskCounts(items, '2026-10-01');

    expect(byProject.get('project-a')).toEqual({ assignedCount: 3, countPartial: true, dueCount: 1 });
    expect(byProject.get('project-b')).toEqual({ assignedCount: 1, countPartial: false, dueCount: 0 });
    expect(byBoard.get('board-a')).toEqual({ assignedCount: 1, countPartial: true, dueCount: 1 });
    expect(byBoard.get('board-b')).toEqual({ assignedCount: 2, countPartial: false, dueCount: 0 });
  });
});
