import { Navigate, createFileRoute } from '@tanstack/react-router'

import TrackLoader from '#/components/TrackLoader'
import { WorkspacePage } from '#/features/workspace/pages/WorkspacePage'
import { useReleaseConfigState } from '#/lib/release-config'

export const Route = createFileRoute('/workspace/')({
  component: WorkspaceHome,
})

function WorkspaceHome() {
  const releaseState = useReleaseConfigState()

  if (releaseState.status === 'loading') return <TrackLoader label="Loading your workspace" />
  if (releaseState.config.companyModel) return <Navigate to="/workspace/company" replace />

  return <WorkspacePage />
}
