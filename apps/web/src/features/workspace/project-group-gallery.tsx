import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { getGroupAvatar } from './group-avatar'

type ProjectGroupGalleryProps = {
  groups: Array<Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
}

export function ProjectGroupGallery({ groups, onOpenGroup }: ProjectGroupGalleryProps) {
  return (
    <div className="track-group-gallery-scroll">
      <div className="track-group-gallery">
        {groups.map((group) => {
          const { Icon, tone } = getGroupAvatar(group)
          return (
            <button
              className="track-group-card"
              key={group._id}
              onClick={() => onOpenGroup(group._id)}
              type="button"
            >
              <span className={`track-group-graphic ${tone}`}>
                <Icon size={22} strokeWidth={2.1} />
              </span>
              <span className="track-group-card-copy">
                <strong>{group.name}</strong>
                <span>{group.kind} conversation</span>
              </span>
              <span className="track-group-card-action">Open chat</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
