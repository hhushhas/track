import { describe, expect, it } from 'vitest';

import { CompactListRowWidth, isCompactListRow } from './adaptive-layout';

describe('isCompactListRow', () => {
  it('compacts below the documented row breakpoint', () => {
    expect(isCompactListRow(CompactListRowWidth - 1)).toBe(true);
  });

  it('keeps the normal layout at and above the breakpoint', () => {
    expect(isCompactListRow(CompactListRowWidth)).toBe(false);
    expect(isCompactListRow(CompactListRowWidth + 120)).toBe(false);
  });

  it('ignores invalid pre-layout measurements', () => {
    expect(isCompactListRow(0)).toBe(false);
    expect(isCompactListRow(Number.NaN)).toBe(false);
    expect(isCompactListRow(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
