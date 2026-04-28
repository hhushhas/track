import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/workspace')({
  component: WorkspaceLayoutRoute,
})

function WorkspaceLayoutRoute() {
  return <Outlet />
}
