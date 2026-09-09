import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'

export const Route = createFileRoute('/workspace/projects/$projectId/evidence')({ component: ProjectEvidenceRoute })

function ProjectEvidenceRoute() {
  const { projectId } = Route.useParams()
  return <WorkspacePage projectId={projectId} view="evidence" />
}
