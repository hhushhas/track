import { Hash, Plus } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'

export function ProjectChannelsPage({
  groups,
  onCreate,
  onOpen,
  projectName,
}: {
  groups: Array<Doc<'groups'>>
  onCreate: () => void
  onOpen: (groupId: Id<'groups'>) => void
  projectName: string
}) {
  return (
    <div className="track-channels-page">
      <header className="track-page-intro track-page-intro-with-action">
        <div><p className="mono-label">Project channels</p><h2>Channels</h2><p>Keep each conversation focused while sharing the same project context.</p></div>
        <Button className="track-button track-button-primary" onClick={onCreate} type="button"><Plus size={14} /> New channel</Button>
      </header>
      {groups.length ? (
        <ul aria-label={`${projectName} channels`} className="track-channel-directory">
          {groups.map((group) => (
            <li key={group._id}>
              <button onClick={() => onOpen(group._id)} type="button">
                <span className="track-channel-directory-icon"><Hash aria-hidden="true" size={16} /></span>
                <span><strong>{group.name}</strong><small>{group.kind.replaceAll('_', ' ')} channel</small></span>
                <span className={`track-status-stamp ${group.status === 'archived' ? 'muted' : ''}`}><i aria-hidden="true" /> {group.status === 'archived' ? 'Archived' : 'Active'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="track-guided-empty track-guided-empty-large"><span className="track-empty-icon"><Hash aria-hidden="true" size={22} /></span><h3>No channels yet</h3><p>Create the first channel for project conversation, decisions, and evidence.</p><Button className="track-button track-button-primary" onClick={onCreate} type="button"><Plus size={14} /> Create channel</Button></section>
      )}
    </div>
  )
}
