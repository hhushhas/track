import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()
  const session = authClient.useSession()

  useEffect(() => {
    if (!session.data) return
    void navigate({ replace: true, to: '/workspace' })
  }, [navigate, session.data])

  return (
    <main className="track-auth-page">
      <TrackLoader label="Finishing Google sign-in" />
    </main>
  )
}
