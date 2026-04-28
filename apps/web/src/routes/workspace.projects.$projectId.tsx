import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/workspace/projects/$projectId')({
  component: ProjectLayoutRoute,
})

function ProjectLayoutRoute() {
  return <Outlet />
}
