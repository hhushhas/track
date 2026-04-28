import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'

export const Route = createFileRoute('/workspace/projects/$projectId/groups/$groupId')({
  component: GroupRoute,
})

function GroupRoute() {
  const { groupId, projectId } = Route.useParams()
  return <WorkspacePage groupId={groupId} projectId={projectId} view="group" />
}
