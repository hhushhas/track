import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/workspace')({
  component: WorkspaceLayoutRoute,
})

function WorkspaceLayoutRoute() {
  const session = authClient.useSession()

  if (session.isPending) return <TrackAccessLoading label="Checking your session" />
  if (!session.data) return <Navigate to="/sign-in" />

  return <Outlet />
}

function TrackAccessLoading({ label }: { label: string }) {
  return (
    <main className="track-loading">
      <div className="track-surface rounded-md p-4 text-center">
        <p className="mono-label m-0">Track Access</p>
        <p className="m-0 mt-2 text-sm text-[var(--ink-3)]">{label}...</p>
      </div>
    </main>
  )
}
