import { describe, expect, it } from 'vitest'

import { getAttachmentNotificationPreview, resolveMentionedUserIds } from './message-send'

describe('workspace message send helpers', () => {
  it('resolves mention handles to member user ids only', () => {
    expect(
      resolveMentionedUserIds(
        ['track', 'general', 'hasan'],
        [
          { id: 'track', kind: 'assistant', label: 'Track', sublabel: 'ai', handle: 'track', tone: 'bot' },
          { id: 'group-1', kind: 'group', label: 'General', sublabel: 'group', handle: 'general', tone: 's-1' },
          { id: 'user-1', kind: 'member', label: 'Hasan', sublabel: 'staff', handle: 'hasan', tone: 's-2' },
        ] as Parameters<typeof resolveMentionedUserIds>[1],
      ),
    ).toEqual(['user-1'])
  })

  it('builds attachment-only notification previews', () => {
    expect(getAttachmentNotificationPreview({ body: 'hello', pendingAttachments: [] })).toBeUndefined()
    expect(
      getAttachmentNotificationPreview({
        body: '',
        pendingAttachments: [{ kind: 'voice_note' }],
      } as Parameters<typeof getAttachmentNotificationPreview>[0]),
    ).toBe('Sent a voice note.')
    expect(
      getAttachmentNotificationPreview({
        body: '',
        pendingAttachments: [{ kind: 'file' }],
      } as Parameters<typeof getAttachmentNotificationPreview>[0]),
    ).toBe('Sent an attachment.')
  })
})
