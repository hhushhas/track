import { describe, expect, it } from 'vitest';

import { CompactBoardBreakpoint, isCompactTaskBoard } from './task-board-layout';

describe('task board responsive layout', () => {
  it('uses one column below the phone breakpoint', () => {
    expect(isCompactTaskBoard(359)).toBe(true);
    expect(isCompactTaskBoard(599)).toBe(true);
  });

  it('keeps the multi-column board at and above the breakpoint', () => {
    expect(isCompactTaskBoard(CompactBoardBreakpoint)).toBe(false);
    expect(isCompactTaskBoard(834)).toBe(false);
  });

  it('fails closed for non-finite measurements', () => {
    expect(isCompactTaskBoard(Number.NaN)).toBe(false);
    expect(isCompactTaskBoard(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
