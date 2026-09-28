import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureNavigation, setDiagnosticAuthenticated } from './browser-diagnostics'

const { ingest } = vi.hoisted(() => ({ ingest: vi.fn().mockResolvedValue({ accepted: 1 }) }))

vi.mock('./convex-client', () => ({
  convexClient: { mutation: ingest },
}))

afterEach(() => {
  setDiagnosticAuthenticated(false)
  vi.clearAllTimers()
  vi.useRealTimers()
  ingest.mockClear()
})

describe('browser diagnostics delivery', () => {
  it('holds events while signed out and flushes only after Convex confirms auth', async () => {
    vi.useFakeTimers()

    captureNavigation('/sign-in')
    await vi.advanceTimersByTimeAsync(300)
    expect(ingest).not.toHaveBeenCalled()

    setDiagnosticAuthenticated(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(ingest).toHaveBeenCalledTimes(1)

    setDiagnosticAuthenticated(false)
    captureNavigation('/sign-in')
    await vi.advanceTimersByTimeAsync(300)
    expect(ingest).toHaveBeenCalledTimes(1)
  })

  it('retries an old-session rejection after a new session authenticates', async () => {
    vi.useFakeTimers()
    let rejectOldSession!: (result: { accepted: 0; rejected: 'unauthenticated' }) => void
    ingest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          rejectOldSession = resolve
        }),
    )

    setDiagnosticAuthenticated(true)
    captureNavigation('/old-session')
    await vi.advanceTimersByTimeAsync(1)
    expect(ingest).toHaveBeenCalledTimes(1)

    setDiagnosticAuthenticated(false)
    setDiagnosticAuthenticated(true)
    captureNavigation('/new-session')
    rejectOldSession({ accepted: 0, rejected: 'unauthenticated' })
    await vi.advanceTimersByTimeAsync(300)
    expect(ingest).toHaveBeenCalledTimes(2)
  })
})
