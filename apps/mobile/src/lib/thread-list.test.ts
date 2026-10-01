import { describe, expect, it } from 'vitest';

import { shouldShowJumpToLatest, stickyDateHeaderIndices } from './thread-list';

describe('stickyDateHeaderIndices', () => {
  it('keeps each visible chat date pinned while its messages scroll', () => {
    const items = [
      { kind: 'date-sep' },
      { kind: 'message' },
      { kind: 'message' },
      { kind: 'date-sep' },
      { kind: 'message' },
    ];

    expect(stickyDateHeaderIndices(items)).toEqual([0, 3]);
    expect(stickyDateHeaderIndices(items, true)).toEqual([1, 4]);
  });

  it('returns no sticky rows when no date boundaries exist', () => {
    expect(stickyDateHeaderIndices([{ kind: 'message' }])).toEqual([]);
  });
});

describe('shouldShowJumpToLatest', () => {
  it('hides the control near the latest messages and shows it after a longer scroll', () => {
    expect(shouldShowJumpToLatest(0)).toBe(false);
    expect(shouldShowJumpToLatest(80)).toBe(false);
    expect(shouldShowJumpToLatest(321)).toBe(true);
  });
});
