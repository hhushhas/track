import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'

export const Route = createFileRoute('/workspace/')({
  validateSearch: (search: Record<string, unknown>): { directory?: boolean } => ({
    directory: search.directory === true || search.directory === 'true',
  }),
  component: WorkspaceIndexRoute,
})

function WorkspaceIndexRoute() {
  const { directory } = Route.useSearch()
  return <WorkspacePage directoryOnly={directory} />
}
