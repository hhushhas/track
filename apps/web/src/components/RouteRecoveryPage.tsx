import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function RouteRecoveryPage({ error, reset }: ErrorComponentProps) {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-foreground">
      <section aria-labelledby="route-recovery-title" className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground">
          {online ? 'Track needs a retry' : 'You are offline'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight" id="route-recovery-title">
          We couldn’t open this view
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {online
            ? 'The conversation or page failed to load. Your unsent local work remains in this session.'
            : 'Reconnect to reload this view. Data that was already on screen remains available when possible.'}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
            onClick={reset}
            type="button"
          >
            Retry
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-2.5 font-semibold"
            to="/workspace"
          >
            Open workspace
          </Link>
        </div>
        {import.meta.env.DEV ? (
          <details className="mt-6 text-left text-xs text-muted-foreground">
            <summary>Technical details</summary>
            <pre className="mt-2 whitespace-pre-wrap">{error instanceof Error ? error.message : 'Unknown route error'}</pre>
          </details>
        ) : null}
      </section>
    </main>
  )
}
