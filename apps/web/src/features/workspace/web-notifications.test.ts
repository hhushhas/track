import { describe, expect, it } from 'vitest'

import { shouldNotifyForIncomingMessage } from './web-notifications'

describe('shouldNotifyForIncomingMessage', () => {
  it('does not notify the sender about their own message', () => {
    expect(
      shouldNotifyForIncomingMessage({
        authorId: 'u1',
        currentUserId: 'u1',
        globalMode: 'all',
        groupMode: 'all',
        mentions: ['u1'],
      }),
    ).toBe(false)
  })

  it('respects mention-only mode', () => {
    expect(
      shouldNotifyForIncomingMessage({
        authorId: 'u2',
        currentUserId: 'u1',
        globalMode: 'mentions',
        groupMode: 'inherit',
        mentions: ['u1'],
      }),
    ).toBe(true)
    expect(
      shouldNotifyForIncomingMessage({
        authorId: 'u2',
        currentUserId: 'u1',
        globalMode: 'mentions',
        groupMode: 'inherit',
        mentions: [],
      }),
    ).toBe(false)
  })
})
