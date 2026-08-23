import { describe, expect, it } from 'vitest'

import { messagePushCopy, retryDelayMs, safePushLabel, taskPushCopy } from './pushDelivery'

describe('privacy-safe push delivery helpers', () => {
  it('keeps message and task previews scoped to the selected privacy mode', () => {
    const messageCases = [
      {
        input: {
          eventKind: 'mention' as const,
          senderName: 'Bilal',
          groupName: '#launch-readiness',
          messagePreview: 'The rollout is ready.',
          previewMode: 'context' as const,
        },
        expected: { title: 'Track', body: 'Bilal mentioned you in #launch-readiness' },
      },
      {
        input: {
          eventKind: 'message' as const,
          senderName: 'Bilal',
          groupName: '#launch',
          messagePreview: 'Sensitive plan',
          previewMode: 'hidden' as const,
        },
        expected: { title: 'Track', body: 'New conversation activity' },
      },
      {
        input: {
          eventKind: 'message' as const,
          senderName: 'Bilal',
          groupName: '#launch',
          messagePreview: ' Ship   the\nrelease tonight. ',
          previewMode: 'full' as const,
        },
        expected: { title: 'Bilal · #launch', body: 'Ship the release tonight.' },
      },
    ]
    for (const testCase of messageCases) {
      expect(messagePushCopy(testCase.input)).toEqual(testCase.expected)
    }

    expect(taskPushCopy({
      eventKind: 'assignment', projectName: 'Mobile release', publicKey: 'T-184',
      taskTitle: 'Prepare the confidential launch', previewMode: 'context',
    })).toEqual({ title: 'Track', body: 'You were assigned T-184 in Mobile release' })
    expect(taskPushCopy({
      eventKind: 'assignment', projectName: 'Mobile release', publicKey: 'T-184',
      taskTitle: 'Prepare the confidential launch', previewMode: 'full',
    })).toEqual({
      title: 'T-184 · Mobile release',
      body: 'You were assigned: Prepare the confidential launch',
    })
    expect(safePushLabel(' Launch\n readiness ', 'Channel')).toBe('Launch readiness')
    expect(retryDelayMs(1)).toBe(1_000)
    expect(retryDelayMs(20)).toBe(30_000)
  })
})
