import { describe, expect, it } from 'vitest'

import { getIncomingMessageNotificationBody } from './web-notifications'

describe('workspace web notification body', () => {
  it('prefers explicit message body', () => {
    expect(getIncomingMessageNotificationBody({ body: 'Hello', attachments: [] })).toBe('Hello')
  })

  it('summarizes voice note, attachment, and empty messages', () => {
    expect(
      getIncomingMessageNotificationBody({
        body: '',
        attachments: [{ attachment: { kind: 'voice_note' } }],
      }),
    ).toBe('Sent a voice note.')
    expect(
      getIncomingMessageNotificationBody({
        body: '',
        attachments: [{ attachment: { kind: 'file' } }],
      }),
    ).toBe('Sent an attachment.')
    expect(getIncomingMessageNotificationBody({ body: '', attachments: [] })).toBe('New message.')
  })
})
