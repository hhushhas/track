import TrackLoader from '#/components/TrackLoader'
import { TrackMorphMark } from '#/components/TrackMorphMark'

export function TrackLoading({ label }: { label: string }) {
  return <TrackLoader label={label} />
}

export function WorkspaceRouteLoader({ label }: { label: string }) {
  return (
    <div className="track-route-loader" role="status" aria-label={label} aria-live="polite">
      <TrackMorphMark className="track-morph-mark-route" />
    </div>
  )
}
