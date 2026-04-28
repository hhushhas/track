import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VoiceNotePlayer } from './voice-notes'

describe('VoiceNotePlayer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('renders a playable voice-note control with duration metadata', () => {
    render(
      <VoiceNotePlayer
        contentType="audio/webm"
        durationMs={18_000}
        filename="voice-note.webm"
        kind="voice_note"
        size={142_000}
        url="blob:voice-note"
      />,
    )

    expect(screen.getByText('Voice note')).toBeTruthy()
    expect(screen.getByText('0:00 / 0:18')).toBeTruthy()
    expect(screen.queryByText('voice-note.webm')).toBeNull()
    expect(screen.getByLabelText('Play voice note')).not.toHaveProperty('disabled', true)
  })

  it('starts playback from the play button', () => {
    render(
      <VoiceNotePlayer
        contentType="audio/webm"
        durationMs={18_000}
        filename="voice-note.webm"
        size={142_000}
        url="blob:voice-note"
      />,
    )

    fireEvent.click(screen.getByLabelText('Play voice note'))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('disables playback when the storage URL is unavailable', () => {
    render(
      <VoiceNotePlayer
        contentType="audio/webm"
        durationMs={18_000}
        filename="voice-note.webm"
        size={142_000}
        url={null}
      />,
    )

    expect(screen.getByLabelText('Play voice note')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('Voice note progress')).toHaveProperty('disabled', true)
  })
})
