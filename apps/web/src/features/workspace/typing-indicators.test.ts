import { describe, expect, it } from 'vitest'

import {
  TYPING_INDICATOR_VISIBLE_MS,
  filterActiveTypingIndicators,
  formatTypingIndicatorText,
} from './typing-indicators'

describe('workspace typing indicators', () => {
  it('formats mixed typing, attachment, and voice-note wording', () => {
    expect(formatTypingIndicatorText([{ name: 'Maya' }, { name: 'Ali' }])).toBe(
      'Maya and Ali are typing',
    )
    expect(formatTypingIndicatorText([{ activity: 'attaching', name: 'Maya' }])).toBe(
      'Maya is adding an attachment',
    )
    expect(
      formatTypingIndicatorText([
        { activity: 'recording', name: 'Maya' },
        { activity: 'recording', name: 'Ali' },
      ]),
    ).toBe('Maya and Ali are recording voice notes')
    expect(
      formatTypingIndicatorText([
        { activity: 'typing', name: 'Maya' },
        { activity: 'recording', name: 'Ali' },
      ]),
    ).toBe('Maya and Ali are composing')
    expect(formatTypingIndicatorText([])).toBe('')
  })

  it('filters stale indicators locally without changing query args', () => {
    const indicators = [
      { indicator: { _id: 'old', updatedAt: 10_000 - TYPING_INDICATOR_VISIBLE_MS - 1 }, user: null },
      { indicator: { _id: 'newer', updatedAt: 9_900 }, user: null },
      { indicator: { _id: 'newest', updatedAt: 10_000 }, user: null },
    ] as unknown as Parameters<typeof filterActiveTypingIndicators>[0]

    expect(filterActiveTypingIndicators(indicators, 10_000).map((item) => item.indicator._id)).toEqual([
      'newest',
      'newer',
    ])
  })
})
