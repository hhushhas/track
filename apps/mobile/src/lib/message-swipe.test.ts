import { describe, expect, it } from 'vitest';

import { messageSwipeIntent } from './message-swipe';

describe('message swipe actions', () => {
  it('opens forward and report actions after a left swipe on a message', () => {
    expect(messageSwipeIntent(-72, true, true)).toBe('actions');
  });

  it('keeps the existing right-swipe reply gesture', () => {
    expect(messageSwipeIntent(72, true, true)).toBe('reply');
  });

  it('closes an open action tray on a right swipe without entering reply mode', () => {
    expect(messageSwipeIntent(72, true, true, true)).toBe('close');
  });

  it('keeps the action tray open after a short drag', () => {
    expect(messageSwipeIntent(24, true, true, true)).toBe('actions');
  });

  it('does not open unavailable actions or respond to a short drag', () => {
    expect(messageSwipeIntent(-72, true, false)).toBe('close');
    expect(messageSwipeIntent(-32, true, true)).toBe('close');
    expect(messageSwipeIntent(72, false, true)).toBe('close');
  });
});
