import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'

export const Route = createFileRoute('/workspace/projects/$projectId/channels')({ component: ProjectChannelsRoute })

function ProjectChannelsRoute() {
  const { projectId } = Route.useParams()
  return <WorkspacePage projectId={projectId} view="channels" />
}
