import { useEffect, useState } from 'react'

const oauthCallbackTimeoutMs = 8_000

function hasOneTimeTokenCallback() {
  if (typeof window === 'undefined') return false
  return new URL(window.location.href).searchParams.has('ott')
}

export function useOAuthCallbackPending(hasSession: boolean) {
  const [pending, setPending] = useState(hasOneTimeTokenCallback)

  useEffect(() => {
    if (!pending) return
    if (hasSession) {
      setPending(false)
      return
    }

    const timeoutId = window.setTimeout(() => setPending(false), oauthCallbackTimeoutMs)
    return () => window.clearTimeout(timeoutId)
  }, [hasSession, pending])

  return pending
}
