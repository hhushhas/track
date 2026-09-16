import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import TrackLoader from './TrackLoader'
import { TrackMorphMark } from './TrackMorphMark'

describe('TrackLoader', () => {
  it('offers recovery when a route query does not resolve', () => {
    vi.useFakeTimers()
    try {
      render(<TrackLoader label="Loading Company workspace" timeoutMs={1000} />)
      expect(screen.getByRole('status', { name: 'Loading Company workspace' })).toBeTruthy()
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('announces the current loading operation and keeps its mark decorative', () => {
    const { container } = render(<TrackLoader label="Connecting your workspace" />)

    expect(screen.getByRole('status', { name: 'Connecting your workspace' })).toBeTruthy()
    expect(screen.getByText('Connecting your workspace')).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it.each([
    [1_000, '5s'],
    [7_500, '7.5s'],
    [20_000, '10s'],
  ])('clamps a %ims request to the supported %s cycle', (durationMs, expectedDuration) => {
    const { container } = render(<TrackMorphMark durationMs={durationMs} />)
    const animations = [
      ...container.querySelectorAll('animate'),
      ...container.querySelectorAll('animateTransform'),
    ]

    expect(animations.length).toBeGreaterThan(0)
    for (const animation of animations) {
      expect(animation.getAttribute('dur')).toBe(expectedDuration)
      expect(animation.getAttribute('repeatCount')).toBe('indefinite')
    }
  })

  it('returns to its opening outline before the loop repeats', () => {
    const { container } = render(<TrackMorphMark />)
    const outlineAnimation = container.querySelector('animate[attributeName="d"]')
    const frames = outlineAnimation?.getAttribute('values')?.split(';')

    expect(frames?.at(-1)).toBe(frames?.at(0))
  })

  it('keeps the mark minimal without decorative crosshair lines', () => {
    const { container } = render(<TrackMorphMark />)

    expect(container.querySelector('.track-morph-center-cross')).toBeNull()
    expect(container.querySelector('.track-morph-satellite path')).toBeNull()
    expect(container.querySelector('.track-morph-static path')).toBeNull()
  })
})
