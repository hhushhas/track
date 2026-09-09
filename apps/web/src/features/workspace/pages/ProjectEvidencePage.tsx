import { FileSearch, MessageSquareText } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { threadHref } from '#/features/threads/thread-navigation'
import { useReleaseConfig } from '#/lib/release-config'

export function ProjectEvidencePage({
  firstGroup,
  projectId,
  actingCompanyId,
  projectMemberId,
}: {
  firstGroup: Doc<'groups'> | undefined
  projectId: Id<'projects'>
  actingCompanyId?: Id<'companies'>
  projectMemberId?: Id<'projectMembers'>
}) {
  const releaseConfig = useReleaseConfig()
  const { results: evidence, status, loadMore } = usePaginatedQuery(
    api.evidence.listProjectPage,
    releaseConfig.tasks ? {
      projectId,
      ...(actingCompanyId && projectMemberId ? { actingCompanyId, projectMemberId } : {}),
    } : 'skip',
    { initialNumItems: 50 },
  )
  return (
    <div className="track-evidence-page">
      <header className="track-page-intro">
        <p className="mono-label">Project evidence</p>
        <h2>Evidence</h2>
        <p>Review the messages, threads, and files that give project work its source context.</p>
      </header>
      {!releaseConfig.tasks ? (
        <section className="track-guided-empty track-guided-empty-large" role="status">
          <span className="track-empty-icon"><FileSearch aria-hidden="true" size={22} /></span>
          <h3>Evidence is unavailable</h3>
          <p>Tasks and their linked evidence are disabled for the current environment.</p>
        </section>
      ) : status === 'LoadingFirstPage' ? <p className="track-guided-empty">Loading project evidence…</p> : evidence.length ? (
        <>
        <ul className="track-evidence-list">
          {evidence.map((item) => {
            const sourceHref = item.group && item.reference.channelThreadId
              ? threadHref(projectId, item.group._id, item.reference.channelThreadId,
                  actingCompanyId && projectMemberId ? { actingCompanyId, projectMemberId } : undefined,
                  item.reference.messageId)
              : item.group
                ? actingCompanyId && projectMemberId
                  ? `/workspace/company-projects/${encodeURIComponent(projectId)}?${new URLSearchParams({ companyId: actingCompanyId, groupId: item.group._id, membershipId: projectMemberId })}${item.reference.messageId ? `#message-${encodeURIComponent(item.reference.messageId)}` : ''}`
                  : `/workspace/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(item.group._id)}${item.reference.messageId ? `#message-${encodeURIComponent(item.reference.messageId)}` : ''}`
                : null
            return <li className="track-evidence-row" key={item.reference._id}>
              <div className="track-evidence-source"><span>{item.reference.channelThreadId ? 'Thread' : item.reference.type.replaceAll('_', ' ')}</span><strong>{item.group ? `# ${item.group.name}` : 'Project source'}</strong></div>
              <blockquote>{item.reference.quote ?? 'Source unavailable'}</blockquote>
              <div className="track-evidence-meta"><span>Task {item.task.publicKey}</span><span>{item.creator?.displayName ?? 'Project member'}</span><time dateTime={new Date(item.reference.createdAt).toISOString()}>{new Date(item.reference.createdAt).toLocaleDateString()}</time></div>
              {sourceHref ? <a className="track-inline-action" href={sourceHref}><MessageSquareText aria-hidden="true" size={15} /> Open source</a> : null}
            </li>
          })}
        </ul>
        {status === 'CanLoadMore' ? <Button onClick={() => loadMore(50)} type="button">Load more evidence</Button> : null}
        </>
      ) : (
        <section className="track-guided-empty track-guided-empty-large">
          <span className="track-empty-icon"><FileSearch aria-hidden="true" size={22} /></span>
          <h3>No project evidence yet</h3>
          <p>Create a task from a message, thread, attachment, or assistant response to preserve its source here.</p>
          {status === 'CanLoadMore' ? <Button onClick={() => loadMore(50)} type="button">Check for more evidence</Button> : null}
          {firstGroup && actingCompanyId && projectMemberId ? (
            <Link
              className="track-inline-action"
              params={{ projectId }}
              search={{ companyId: actingCompanyId, groupId: firstGroup._id, membershipId: projectMemberId, view: 'channels' }}
              to="/workspace/company-projects/$projectId"
            >
              <MessageSquareText aria-hidden="true" size={15} /> Open {firstGroup.name}
            </Link>
          ) : firstGroup ? (
            <Link className="track-inline-action" params={{ groupId: firstGroup._id, projectId }} to="/workspace/projects/$projectId/groups/$groupId">
              <MessageSquareText aria-hidden="true" size={15} /> Open {firstGroup.name}
            </Link>
          ) : null}
        </section>
      )}
    </div>
  )
}
