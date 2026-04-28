import { describe, expect, it, vi } from 'vitest'

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

  it('shows a foreground notification even when web push is supported', async () => {
    const notification = vi.fn()
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notification, { permission: 'granted' }),
    })
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: class PushManager {},
    })

    const { showMessageNotification } = await import('./web-notifications')
    await expect(
      showMessageNotification({
        title: 'Track',
        body: 'Hello',
        tag: 'test',
        url: '/workspace',
      }),
    ).resolves.toBeUndefined()
    expect(notification).toHaveBeenCalledWith(
      'Track',
      expect.objectContaining({
        body: 'Hello',
        tag: 'test',
      }),
    )
  })
})
