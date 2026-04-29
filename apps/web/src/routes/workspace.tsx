import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/workspace')({
  component: WorkspaceLayoutRoute,
})

function WorkspaceLayoutRoute() {
  const session = authClient.useSession()

  if (session.isPending) return <TrackLoader label="Checking your session" />
  if (!session.data) return <Navigate to="/sign-in" />

  return <Outlet />
}
