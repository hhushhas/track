import { describe, expect, it } from 'vitest'

import { shouldNotifyForMessage } from './notifications'

describe('message notification preference precedence', () => {
  it('applies mute, direct-reply, mention, and ordinary-activity precedence', () => {
    const cases = [
      {
        input: { globalMode: 'all' as const, groupMode: 'none' as const, mentioned: true, directReply: true },
        expected: false,
      },
      {
        input: { globalMode: 'mentions' as const, groupMode: 'inherit' as const, mentioned: false, directReply: true },
        expected: true,
      },
      {
        input: { globalMode: 'mentions' as const, groupMode: 'inherit' as const, mentioned: true },
        expected: true,
      },
      {
        input: { globalMode: 'all' as const, groupMode: 'inherit' as const, mentioned: false },
        expected: true,
      },
    ]
    for (const testCase of cases) {
      expect(shouldNotifyForMessage(testCase.input)).toBe(testCase.expected)
    }
  })
})
