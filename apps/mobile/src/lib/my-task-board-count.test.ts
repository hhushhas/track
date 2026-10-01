import { describe, expect, it } from 'vitest';

import { boardTaskCountBadge } from './my-task-board-count';

describe('My Tasks Board task-count badges', () => {
  it('does not show a zero badge while task counts are partial', () => {
    expect(boardTaskCountBadge(0, true)).toBeNull();
  });

  it('marks a partial count as a lower bound', () => {
    expect(boardTaskCountBadge(8, true)).toEqual({
      accessibilityLabel: '8 or more assigned tasks',
      text: '8+',
    });
  });

  it('caps large visible counts while keeping the accessible count descriptive', () => {
    expect(boardTaskCountBadge(120, false)).toEqual({
      accessibilityLabel: '99 or more assigned tasks',
      text: '99+',
    });
  });
});
