import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'

import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'
import { useDevAuthBypass } from '#/lib/dev-auth-bypass'
import { useOAuthCallbackPending } from '#/lib/oauth-callback'
import { getSessionDataForRender } from '#/features/workspace/workspace-session'

export const Route = createFileRoute('/workspace')({
  component: WorkspaceLayoutRoute,
})

function WorkspaceLayoutRoute() {
  const convexAuth = useConvexAuth()
  const session = authClient.useSession()
  const devAuthBypass = useDevAuthBypass()
  const sessionDataForRender = getSessionDataForRender(
    session.data,
    session.isPending,
    authClient.getSessionData?.(),
  )
  const hasSessionAccess = Boolean(sessionDataForRender || devAuthBypass.enabled)
  const oauthCallbackPending = useOAuthCallbackPending(hasSessionAccess)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  const stillLoading = (session.isPending && !sessionDataForRender && !devAuthBypass.enabled) || convexAuth.isLoading
  useEffect(() => {
    if (!stillLoading) {
      setLoadingTimedOut(false)
      return
    }
    const timeout = window.setTimeout(() => setLoadingTimedOut(true), 8000)
    return () => window.clearTimeout(timeout)
  }, [stillLoading])

  if (loadingTimedOut) {
    return <main className="track-loading" role="alert"><p>Track is taking longer than expected to connect your workspace.</p><div><button className="track-button track-button-primary" onClick={() => window.location.reload()} type="button">Retry</button> <Link to="/sign-in">Sign in again</Link></div></main>
  }

  if (devAuthBypass.allowed && !devAuthBypass.hydrated && !devAuthBypass.enabled) {
    return <TrackLoader label="Checking your session" />
  }
  if (oauthCallbackPending) return <TrackLoader label="Finishing Google sign-in" />
  if (session.isPending && !sessionDataForRender && !devAuthBypass.enabled) {
    return <TrackLoader label="Checking your session" />
  }
  if (!hasSessionAccess) return <Navigate to="/sign-in" />
  if (convexAuth.isLoading) return <TrackLoader label="Connecting your workspace" />
  if (!convexAuth.isAuthenticated) {
    return (
      <main className="track-loading">
        <p role="alert">We couldn’t connect your session to the workspace.</p>
        <Link to="/sign-in">Sign in again</Link>
      </main>
    )
  }

  return <Outlet />
}
