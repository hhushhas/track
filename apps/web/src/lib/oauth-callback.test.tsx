import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOAuthCallbackPending } from './oauth-callback'

describe('useOAuthCallbackPending', () => {
  it('holds workspace redirects while an OAuth one-time token is being verified', () => {
    window.history.replaceState({}, '', '/workspace?ott=token-123')

    const { result } = renderHook(() => useOAuthCallbackPending(false))

    expect(result.current).toBe(true)
  })

  it('eventually releases the gate if the OAuth callback cannot complete', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/workspace?ott=token-123')

    const { result } = renderHook(() => useOAuthCallbackPending(false))

    act(() => vi.advanceTimersByTime(8_000))

    expect(result.current).toBe(false)
    vi.useRealTimers()
  })
})
