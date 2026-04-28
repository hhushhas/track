import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'

export const Route = createFileRoute('/workspace/projects/$projectId/records')({
  component: ProjectRecordsRoute,
})

function ProjectRecordsRoute() {
  const { projectId } = Route.useParams()
  return <WorkspacePage projectId={projectId} view="records" />
}
