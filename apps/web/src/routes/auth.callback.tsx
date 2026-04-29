import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const session = authClient.useSession()
  const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const next = search.get('next') || '/workspace'

  useEffect(() => {
    if (!session.data) return
    window.location.replace(next.startsWith('/') ? next : '/workspace')
  }, [next, session.data])

  return (
    <main className="track-auth-page">
      <TrackLoader label="Finishing Google sign-in" />
    </main>
  )
}
