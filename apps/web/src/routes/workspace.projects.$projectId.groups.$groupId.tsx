import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/workspace/projects/$projectId/groups/$groupId')({
  component: GroupRouteLayout,
})

export function GroupRouteLayout() {
  return <Outlet />
}
