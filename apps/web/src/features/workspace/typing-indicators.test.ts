import { describe, expect, it } from 'vitest'

import {
  TYPING_INDICATOR_VISIBLE_MS,
  filterActiveTypingIndicators,
  formatTypingIndicatorText,
} from './typing-indicators'

describe('workspace typing indicators', () => {
  it('formats no active typers as empty text', () => {
    expect(formatTypingIndicatorText([])).toBe('')
  })

  it('formats a single active typer', () => {
    expect(formatTypingIndicatorText([{ name: 'Maya' }])).toBe('Maya is typing')
  })

  it('spells out two active typers', () => {
    expect(formatTypingIndicatorText([{ name: 'Maya' }, { name: 'Ali' }])).toBe(
      'Maya and Ali are typing',
    )
  })

  it('summarizes additional active typers as others', () => {
    expect(formatTypingIndicatorText([{ name: 'Maya' }, { name: 'Ali' }, { name: 'Sarah' }])).toBe(
      'Maya, Ali, and 1 other are typing',
    )
    expect(
      formatTypingIndicatorText([
        { name: 'Maya' },
        { name: 'Ali' },
        { name: 'Sarah' },
        { name: 'Hasan' },
      ]),
    ).toBe('Maya, Ali, and 2 others are typing')
  })

  it('formats richer composing states', () => {
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
  })

  it('ignores blank names', () => {
    expect(formatTypingIndicatorText([{ name: 'Maya' }, { name: ' ' }, { name: 'Ali' }])).toBe(
      'Maya and Ali are typing',
    )
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
