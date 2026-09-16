import { describe, expect, it } from 'vitest'

import { formatDateInputValue, formatTaskTimestamp } from './task-date'

describe('task date formatting', () => {
  it('returns a date-input-compatible local date', () => {
    expect(formatDateInputValue(new Date(2026, 8, 11, 12, 0, 0))).toBe('2026-09-11')
  })

  it('uses Gregorian ASCII fields instead of locale-formatted parts', () => {
    const date = new Date(2026, 0, 2, 12, 0, 0)
    expect(formatDateInputValue(date)).toBe('2026-01-02')
    expect(formatDateInputValue(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formats notification timestamps with the active locale', () => {
    const timestamp = Date.UTC(2026, 8, 11, 12, 30)
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp)
    expect(formatTaskTimestamp(timestamp)).toBe(expected)
  })
})
