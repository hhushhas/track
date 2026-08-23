import { describe, expect, it, vi } from 'vitest'

import {
  getPreferredVoiceMimeType,
  isAudioAttachment,
  isVoiceNoteAttachment,
} from './voice-notes'

describe('workspace voice note helpers', () => {
  it('classifies audio and explicit voice-note attachments', () => {
    expect(isAudioAttachment({ contentType: 'audio/webm', filename: 'note.webm' })).toBe(true)
    expect(isAudioAttachment({ contentType: '', filename: 'note.m4a' })).toBe(true)
    expect(isAudioAttachment({ contentType: 'application/pdf', filename: 'brief.pdf' })).toBe(false)
    expect(
      isVoiceNoteAttachment({
        contentType: 'application/octet-stream',
        filename: 'voice-note.bin',
        kind: 'voice_note',
      }),
    ).toBe(true)
    expect(isVoiceNoteAttachment({ contentType: 'audio/webm', filename: 'note.webm' })).toBe(false)
  })

  it('falls back to the first supported browser recording type', () => {
    class MediaRecorderMock {
      static isTypeSupported = vi.fn((type: string) => type === 'audio/webm')
    }
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: MediaRecorderMock,
    })

    expect(getPreferredVoiceMimeType()).toBe('audio/webm')
    expect(MediaRecorderMock.isTypeSupported.mock.calls).toEqual([
      ['audio/webm;codecs=opus'],
      ['audio/webm'],
    ])
  })
})
