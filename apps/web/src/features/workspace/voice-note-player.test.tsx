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

  it('fills the progress control when playback ends', () => {
    const { container } = render(
      <VoiceNotePlayer
        contentType="audio/webm"
        durationMs={3_000}
        filename="voice-note.webm"
        kind="voice_note"
        size={142_000}
        url="blob:voice-note"
      />,
    )
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 3,
    })
    fireEvent.ended(audio as HTMLAudioElement)

    expect(screen.getByLabelText('Voice note progress')).toHaveProperty('value', '100')
    expect(screen.getByText('0:03 / 0:03')).toBeTruthy()
  })

  it('uses measured media duration when it is longer than metadata', () => {
    const { container } = render(
      <VoiceNotePlayer
        contentType="audio/webm"
        durationMs={2_000}
        filename="voice-note.webm"
        kind="voice_note"
        size={142_000}
        url="blob:voice-note"
      />,
    )
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 2.6,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      value: 2.4,
    })
    fireEvent.loadedMetadata(audio as HTMLAudioElement)
    fireEvent.timeUpdate(audio as HTMLAudioElement)

    expect(screen.getByLabelText('Voice note progress')).toHaveProperty('value', '100')
    expect(screen.getByText('0:03 / 0:03')).toBeTruthy()
  })
})
