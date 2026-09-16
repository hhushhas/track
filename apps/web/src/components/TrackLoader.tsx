import { useEffect, useState } from 'react'

import { TrackMorphMark } from './TrackMorphMark'

function TrackLoader({
  label,
  timeoutMs = 10000,
  timeoutMessage = 'This is taking longer than expected.',
}: {
  label: string
  timeoutMs?: number
  timeoutMessage?: string
}) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!timeoutMs) return
    const timeout = window.setTimeout(() => setTimedOut(true), timeoutMs)
    return () => window.clearTimeout(timeout)
  }, [timeoutMs])

  if (timedOut) {
    return (
      <main className="track-loading" role="alert">
        <TrackMorphMark className="track-morph-mark-full" />
        <p>{timeoutMessage}</p>
        <div className="track-loading-actions">
          <button className="track-button track-button-primary" onClick={() => window.location.reload()} type="button">
            Retry
          </button>
          <a href="/workspace">Open workspace</a>
        </div>
      </main>
    )
  }

  return (
    <main className="track-loading" role="status" aria-live="polite" aria-label={label}>
      <TrackMorphMark className="track-morph-mark-full" />
      <p>{label}</p>
    </main>
  )
}

export default TrackLoader
