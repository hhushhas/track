import { describe, expect, it } from 'vitest';

import { CompactBoardBreakpoint, isCompactTaskBoard, taskBoardColumnIndex } from './task-board-layout';

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

describe('task board column navigation', () => {
  it('selects the column nearest to the horizontal offset', () => {
    expect(taskBoardColumnIndex(0, 292, 5)).toBe(0);
    expect(taskBoardColumnIndex(170, 292, 5)).toBe(1);
    expect(taskBoardColumnIndex(590, 292, 5)).toBe(2);
  });

  it('clamps overscroll and invalid measurements', () => {
    expect(taskBoardColumnIndex(-90, 292, 5)).toBe(0);
    expect(taskBoardColumnIndex(9_000, 292, 5)).toBe(4);
    expect(taskBoardColumnIndex(100, 0, 5)).toBe(0);
    expect(taskBoardColumnIndex(Number.NaN, 292, 5)).toBe(0);
  });
});
