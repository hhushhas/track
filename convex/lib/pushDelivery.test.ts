import { describe, expect, it } from 'vitest'

import { classifyExpoFailure, messagePushCopy, retryDelayMs, safePushLabel, taskPushCopy } from './pushDelivery'

describe('privacy-safe push delivery helpers', () => {
  it('builds context-only message copy without source content', () => {
    expect(messagePushCopy({
      eventKind: 'mention',
      senderName: 'Bilal',
      groupName: '#launch-readiness',
      previewMode: 'context',
    })).toEqual({ title: 'Track', body: 'Bilal mentioned you in #launch-readiness' })
    expect(messagePushCopy({
      eventKind: 'message', senderName: 'Bilal', groupName: '#launch', previewMode: 'hidden',
    }).body).toBe('New conversation activity')
  })

  it('builds task copy from public context, never a task title', () => {
    expect(taskPushCopy({
      eventKind: 'assignment', projectName: 'Mobile release', publicKey: 'T-184', previewMode: 'context',
    }).body).toBe('You were assigned T-184 in Mobile release')
  })

  it('normalizes labels and bounds retry backoff', () => {
    expect(safePushLabel(' Launch\n readiness ', 'Channel')).toBe('Launch readiness')
    expect(retryDelayMs(1)).toBe(1_000)
    expect(retryDelayMs(20)).toBe(30_000)
  })

  it('separates transient and permanent provider failures', () => {
    expect(classifyExpoFailure({ error: 'DeviceNotRegistered' })).toEqual({
      category: 'device_not_registered', permanent: true,
    })
    expect(classifyExpoFailure({ httpStatus: 429 }).permanent).toBe(false)
    expect(classifyExpoFailure({ httpStatus: 503 }).category).toBe('provider_unavailable')
  })
})
