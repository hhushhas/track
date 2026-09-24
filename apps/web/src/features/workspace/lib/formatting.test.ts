import { describe, expect, it } from 'vitest'

import { formatEnumLabel } from './formatting'

describe('formatEnumLabel', () => {
  it('turns backend enum values into readable labels', () => {
    expect(formatEnumLabel('archive_pending')).toBe('Archive Pending')
    expect(formatEnumLabel('due_today')).toBe('Due Today')
  })

  it('does not create empty words from repeated separators', () => {
    expect(formatEnumLabel('  task__suggestion  ')).toBe('Task Suggestion')
  })
})
