import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'
import { useDevAuthBypass } from '#/lib/dev-auth-bypass'
import { useOAuthCallbackPending } from '#/lib/oauth-callback'

export const Route = createFileRoute('/workspace')({
  component: WorkspaceLayoutRoute,
})

function WorkspaceLayoutRoute() {
  const session = authClient.useSession()
  const devAuthBypass = useDevAuthBypass()
  const hasSessionAccess = Boolean(session.data || devAuthBypass.enabled)
  const oauthCallbackPending = useOAuthCallbackPending(hasSessionAccess)

  if (devAuthBypass.allowed && !devAuthBypass.hydrated && !devAuthBypass.enabled) {
    return <TrackLoader label="Checking your session" />
  }
  if (oauthCallbackPending) return <TrackLoader label="Finishing Google sign-in" />
  if (session.isPending && !devAuthBypass.enabled) return <TrackLoader label="Checking your session" />
  if (!hasSessionAccess) return <Navigate to="/sign-in" />

  return <Outlet />
}
