import { describe, expect, it } from 'vitest'

import { messagePushCopy, retryDelayMs, safePushLabel, taskPushCopy } from './pushDelivery'

describe('privacy-safe push delivery helpers', () => {
  it('builds context-only message copy without source content', () => {
    expect(messagePushCopy({
      eventKind: 'mention',
      senderName: 'Bilal',
      groupName: '#launch-readiness',
      messagePreview: 'The rollout is ready.',
      previewMode: 'context',
    })).toEqual({ title: 'Track', body: 'Bilal mentioned you in #launch-readiness' })
    expect(messagePushCopy({
      eventKind: 'message', senderName: 'Bilal', groupName: '#launch',
      messagePreview: 'Sensitive plan', previewMode: 'hidden',
    }).body).toBe('New conversation activity')
  })

  it('includes normalized message content only in full preview mode', () => {
    expect(messagePushCopy({
      eventKind: 'message',
      senderName: 'Bilal',
      groupName: '#launch',
      messagePreview: ' Ship   the\nrelease tonight. ',
      previewMode: 'full',
    })).toEqual({
      title: 'Bilal · #launch',
      body: 'Ship the release tonight.',
    })
  })

  it('builds task copy from public context, never a task title', () => {
    expect(taskPushCopy({
      eventKind: 'assignment', projectName: 'Mobile release', publicKey: 'T-184',
      taskTitle: 'Prepare the confidential launch', previewMode: 'context',
    }).body).toBe('You were assigned T-184 in Mobile release')
  })

  it('includes the task title only in full preview mode', () => {
    expect(taskPushCopy({
      eventKind: 'assignment',
      projectName: 'Mobile release',
      publicKey: 'T-184',
      taskTitle: 'Prepare the confidential launch',
      previewMode: 'full',
    })).toEqual({
      title: 'T-184 · Mobile release',
      body: 'You were assigned: Prepare the confidential launch',
    })
  })

  it('normalizes labels and bounds retry backoff', () => {
    expect(safePushLabel(' Launch\n readiness ', 'Channel')).toBe('Launch readiness')
    expect(retryDelayMs(1)).toBe(1_000)
    expect(retryDelayMs(20)).toBe(30_000)
  })
})
