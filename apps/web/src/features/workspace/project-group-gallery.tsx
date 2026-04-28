import { MessagesSquare } from 'lucide-react'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'

type ProjectGroupGalleryProps = {
  groups: Array<Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
}

export function ProjectGroupGallery({ groups, onOpenGroup }: ProjectGroupGalleryProps) {
  return (
    <div className="track-group-gallery-scroll">
      <div className="track-group-gallery">
        {groups.map((group) => (
          <button
            className="track-group-card"
            key={group._id}
            onClick={() => onOpenGroup(group._id)}
            type="button"
          >
            <span className={`track-group-graphic ${group.kind}`}>
              <MessagesSquare size={22} />
            </span>
            <span className="track-group-card-copy">
              <strong>{group.name}</strong>
              <span>{group.kind} · AI review every {group.aiReviewSettings?.frequencyMinutes ?? 30}m</span>
            </span>
            <span className="track-group-card-action">Open chat</span>
          </button>
        ))}
        {groups.length === 0 ? (
          <div className="track-empty">
            <p className="mono-label m-0">No Groups</p>
            <p>Create a group to start a focused project conversation.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
