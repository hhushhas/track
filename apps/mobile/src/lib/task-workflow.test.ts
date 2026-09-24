import { describe, expect, it } from 'vitest';

import {
  adjacentBoardStateId,
  boardPageIndex,
  resolveWorkflowStateId,
  taskMatchesWorkflowStateFilter,
  visibleBoardStateIds,
} from './task-workflow';

const states = [
  { _id: 'backlog', isDefault: false },
  { _id: 'todo', isDefault: true },
  { _id: 'done', isDefault: false },
];

describe('resolveWorkflowStateId', () => {
  it('preserves a status that belongs to the selected board', () => {
    expect(resolveWorkflowStateId(states, 'done')).toBe('done');
  });

  it('uses the board default when the current status is missing', () => {
    expect(resolveWorkflowStateId(states, 'other-board-state')).toBe('todo');
  });

  it('falls back to the first status and handles an empty workflow', () => {
    expect(resolveWorkflowStateId(states.map((state) => ({ ...state, isDefault: false })))).toBe('backlog');
    expect(resolveWorkflowStateId([])).toBe('');
  });
});

describe('taskMatchesWorkflowStateFilter', () => {
  it('includes every task when no exact status is selected', () => {
    expect(taskMatchesWorkflowStateFilter('in-progress', '')).toBe(true);
  });

  it('matches only the selected workflow status', () => {
    expect(taskMatchesWorkflowStateFilter('in-progress', 'in-progress')).toBe(true);
    expect(taskMatchesWorkflowStateFilter('todo', 'in-progress')).toBe(false);
  });
});

describe('adjacentBoardStateId', () => {
  it('moves between adjacent visible Kanban states', () => {
    expect(adjacentBoardStateId(states, 'todo', -1)).toBe('backlog');
    expect(adjacentBoardStateId(states, 'todo', 1)).toBe('done');
  });

  it('does not wrap at the ends and recovers from a stale active state', () => {
    expect(adjacentBoardStateId(states, 'backlog', -1)).toBe('backlog');
    expect(adjacentBoardStateId(states, 'done', 1)).toBe('done');
    expect(adjacentBoardStateId(states, 'removed', 1)).toBe('backlog');
    expect(adjacentBoardStateId([], 'removed', 1)).toBe('');
  });
});

describe('boardPageIndex', () => {
  it('selects the nearest page after a native paging gesture', () => {
    expect(boardPageIndex(0, 320, 4)).toBe(0);
    expect(boardPageIndex(319, 320, 4)).toBe(1);
    expect(boardPageIndex(641, 320, 4)).toBe(2);
  });

  it('clamps overscroll and invalid layout measurements', () => {
    expect(boardPageIndex(-40, 320, 4)).toBe(0);
    expect(boardPageIndex(1600, 320, 4)).toBe(3);
    expect(boardPageIndex(400, 0, 4)).toBe(0);
    expect(boardPageIndex(Number.NaN, 320, 4)).toBe(0);
    expect(boardPageIndex(400, 320, 0)).toBe(0);
  });
});

describe('visibleBoardStateIds', () => {
  const columns = [
    { _id: 'backlog', taskCount: 0 },
    { _id: 'todo', taskCount: 2 },
    { _id: 'done', taskCount: 0 },
  ];

  it('keeps every configured status visible by default', () => {
    expect(visibleBoardStateIds(columns, '', false)).toEqual(['backlog', 'todo', 'done']);
  });

  it('does not restore empty statuses when hide-empty leaves no result', () => {
    expect(visibleBoardStateIds(columns.map((column) => ({ ...column, taskCount: 0 })), '', true)).toEqual([]);
    expect(visibleBoardStateIds(columns, 'done', true)).toEqual([]);
  });

  it('keeps an explicitly selected empty status when hide-empty is off', () => {
    expect(visibleBoardStateIds(columns, 'done', false)).toEqual(['done']);
  });
});
