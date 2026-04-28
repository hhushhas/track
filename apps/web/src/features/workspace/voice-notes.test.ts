import { describe, expect, it, vi } from 'vitest'

import {
  createVoiceNoteFilename,
  formatVoiceDuration,
  getPreferredVoiceMimeType,
  isAudioAttachment,
  isVoiceNoteAttachment,
} from './voice-notes'

describe('workspace voice note helpers', () => {
  it('detects audio attachments from content type and extension', () => {
    expect(isAudioAttachment({ contentType: 'audio/webm', filename: 'note.webm' })).toBe(true)
    expect(isAudioAttachment({ contentType: '', filename: 'note.m4a' })).toBe(true)
    expect(isAudioAttachment({ contentType: 'application/pdf', filename: 'brief.pdf' })).toBe(false)
  })

  it('treats explicit voice-note metadata as voice even with generic content type', () => {
    expect(
      isVoiceNoteAttachment({
        contentType: 'application/octet-stream',
        filename: 'voice-note.bin',
        kind: 'voice_note',
      }),
    ).toBe(true)
  })

  it('formats voice durations compactly', () => {
    expect(formatVoiceDuration(0)).toBe('0:00')
    expect(formatVoiceDuration(999)).toBe('0:01')
    expect(formatVoiceDuration(61_000)).toBe('1:01')
  })

  it('chooses the first supported browser recording type', () => {
    class MediaRecorderMock {
      static isTypeSupported = vi.fn((type: string) => type === 'audio/webm')
    }
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: MediaRecorderMock,
    })

    expect(getPreferredVoiceMimeType()).toBe('audio/webm')
  })

  it('creates stable voice-note filenames', () => {
    expect(createVoiceNoteFilename(new Date('2026-04-28T18:57:30.123Z'))).toBe(
      'voice-note-2026-04-28T18-57-30Z.webm',
    )
  })
})
