import { afterEach, describe, expect, it, vi } from 'vitest'

import { shouldNotifyForIncomingMessage } from './web-notifications'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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

  it('explains browser push-service subscription timeouts', async () => {
    vi.useFakeTimers()
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(() => new Promise(() => undefined)),
      },
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        getRegistration: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    })
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: class PushManager {},
    })

    const { subscribeToWebPush } = await import('./web-notifications')
    const promise = subscribeToWebPush('BJfhJ9zxJ-CjTvkJylrr-Eoxax__6OQfO3JD2Q4wRblwP-9USQDGQmcJA2jZdHfyOhvIF0trybuTzrup0C1qV-4')
    const assertion = expect(promise).rejects.toThrow('browser push service did not finish')
    await vi.advanceTimersByTimeAsync(45_000)
    await assertion
  })
})
