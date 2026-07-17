import { describe, expect, it } from 'vitest'

import { shouldNotifyForMessage } from './notifications'

describe('message notification preference precedence', () => {
  it('lets an explicit mute win over mentions and direct replies', () => {
    expect(shouldNotifyForMessage({
      globalMode: 'all', groupMode: 'none', mentioned: true, directReply: true,
    })).toBe(false)
  })

  it('delivers direct replies and mentions through mentions-only mode', () => {
    expect(shouldNotifyForMessage({
      globalMode: 'mentions', groupMode: 'inherit', mentioned: false, directReply: true,
    })).toBe(true)
    expect(shouldNotifyForMessage({
      globalMode: 'mentions', groupMode: 'inherit', mentioned: true,
    })).toBe(true)
  })

  it('defaults ordinary eligible Channel activity on', () => {
    expect(shouldNotifyForMessage({
      globalMode: 'all', groupMode: 'inherit', mentioned: false,
    })).toBe(true)
  })
})
