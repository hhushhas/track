import { LoaderCircle } from 'lucide-react'

import TrackLoader from '#/components/TrackLoader'

export function TrackLoading({ label }: { label: string }) {
  return <TrackLoader label={label} />
}

export function WorkspaceRouteLoader({ label }: { label: string }) {
  return (
    <div className="track-route-loader" role="status" aria-label={label} aria-live="polite">
      <LoaderCircle className="track-route-loader-icon" size={18} />
    </div>
  )
}
