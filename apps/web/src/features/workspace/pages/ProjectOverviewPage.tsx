import { Building2, Hash, Users } from 'lucide-react'

import type { Doc } from '../../../../../../convex/_generated/dataModel'

export function ProjectOverviewPage({
  groups,
  members,
  project,
}: {
  groups: Array<Doc<'groups'>>
  members: Array<{ membership: Doc<'projectMembers'>; user: Doc<'users'> | null }>
  project: Doc<'projects'>
}) {
  const manager = members.find((item) => item.membership.role === 'manager')
  const companyNames = Array.from(new Set(members.flatMap((item) =>
    item.membership.companyDisplayNameSnapshot ? [item.membership.companyDisplayNameSnapshot] : [],
  )))

  return (
    <div className="track-project-overview">
      <header className="track-project-overview-hero">
        <div>
          <p className="mono-label">Project overview</p>
          <h2>{project.name}</h2>
          <p>{project.description?.trim() || 'Add a description so everyone understands the outcome this project is working toward.'}</p>
        </div>
        <span className={`track-status-stamp ${project.status === 'archived' ? 'muted' : ''}`}>
          <i aria-hidden="true" /> {project.status === 'archived' ? 'Archived' : 'Active'}
        </span>
      </header>

      <section aria-labelledby="project-at-a-glance" className="track-project-summary-grid">
        <h3 className="sr-only" id="project-at-a-glance">Project at a glance</h3>
        <article><Users aria-hidden="true" size={17} /><span><strong>{members.length}</strong><small>Project members</small></span></article>
        <article><Hash aria-hidden="true" size={17} /><span><strong>{groups.length}</strong><small>Channels</small></span></article>
        <article><Building2 aria-hidden="true" size={17} /><span><strong>{companyNames.length}</strong><small>Participating companies</small></span></article>
      </section>

      <div className="track-project-overview-columns">
        <section aria-labelledby="project-details-heading" className="track-overview-section">
          <div className="track-section-heading">
            <div><h3 id="project-details-heading">Project details</h3><p>The people, scope, and status everyone shares.</p></div>
          </div>
          <dl className="track-definition-list">
            <div><dt>Project manager</dt><dd>{manager?.user?.displayName ?? manager?.membership.userDisplayNameSnapshot ?? 'Not assigned'}</dd></div>
            <div><dt>Status</dt><dd>{project.status === 'archived' ? 'Archived' : 'Active'}</dd></div>
            <div><dt>Last activity</dt><dd>{new Date(project.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="participating-companies-heading" className="track-overview-section">
          <div className="track-section-heading">
            <div><h3 id="participating-companies-heading">Participating companies</h3><p>Companies represented by current project members.</p></div>
          </div>
          {companyNames.length ? <ul className="track-compact-rows">{companyNames.map((name) => <li key={name}><span className="track-company-mark" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span><strong>{name}</strong></li>)}</ul> : <p className="track-guided-empty">This legacy project is not connected to a company yet.</p>}
        </section>
      </div>
    </div>
  )
}
