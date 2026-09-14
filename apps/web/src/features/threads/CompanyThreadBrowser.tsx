import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { MessageSquare, Plus, Search } from 'lucide-react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useReleaseConfig } from '#/lib/release-config'
import type { RepresentedThreadContext } from './thread-navigation'
import { ThreadLink } from './ChannelThreadBrowser'

export function CompanyThreadBrowser({
  context,
  projectId,
  userId,
  companyName,
  activeChannel,
  readOnly = false,
}: {
  context?: RepresentedThreadContext
  projectId: Id<'projects'>
  userId: Id<'users'>
  companyName?: string
  activeChannel?: { _id: Id<'groups'>; name: string }
  readOnly?: boolean
}) {
  const releaseConfig = useReleaseConfig()
  const navigate = useNavigate()
  const searchId = useId()
  const threadNameId = useId()
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [search, setSearch] = useState('')
  const [threadName, setThreadName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const createThread = useMutation(api.channelThreads.create)
  const {
    results: threads,
    status: threadPageStatus,
    loadMore: loadMoreThreads,
  } = usePaginatedQuery(
    api.channelThreads.listProjectPage,
    releaseConfig.threads
      ? {
          projectId,
          userId,
          actingCompanyId: context?.actingCompanyId,
          projectMemberId: context?.projectMemberId,
          status,
        }
      : 'skip',
    { initialNumItems: 40 },
  )
  const searchTerm = search.trim()
  const normalizedSearchTerm = searchTerm.toLocaleLowerCase()
  const searchResults = useQuery(
    api.search.project,
    releaseConfig.threads && searchTerm.length >= 2
      ? {
          actingCompanyId: context?.actingCompanyId,
          filter: 'threads',
          limit: 12,
          projectId,
          projectMemberId: context?.projectMemberId,
          query: searchTerm,
          threadStatus: status,
          userId,
        }
      : 'skip',
  )
  const visibleThreads = useMemo(
    () => (threads ?? []).filter((item) => {
      if (!normalizedSearchTerm) return true
      return `${item.thread.name} ${item.channel?.name ?? ''}`.toLocaleLowerCase().includes(normalizedSearchTerm)
    }),
    [normalizedSearchTerm, threads],
  )
  const matchingSearchThreads = searchResults?.threads ?? []
  const searching = searchTerm.length >= 2
  const visibleCount = searching ? matchingSearchThreads.length : visibleThreads.length

  if (!releaseConfig.threads) return null

  async function submitThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeChannel || !threadName.trim() || readOnly) return
    setSaving(true)
    setError(null)
    idempotencyKey.current ??= crypto.randomUUID()
    try {
      const threadId = await createThread({
        actingCompanyId: context?.actingCompanyId,
        creatorId: userId,
        groupId: activeChannel._id,
        idempotencyKey: idempotencyKey.current,
        name: threadName.trim(),
        projectId,
        projectMemberId: context?.projectMemberId,
      })
      await navigate({
        to: '/workspace/projects/$projectId/groups/$groupId/threads/$threadId',
        params: { groupId: activeChannel._id, projectId, threadId },
        search: {
          companyId: context?.actingCompanyId ?? '',
          membershipId: context?.projectMemberId ?? '',
        },
      })
      idempotencyKey.current = null
      setThreadName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't start thread")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Company threads" className="track-rail-thread-section track-rail-company-thread-section">
      <header>
        <div>
          <span>Company threads</span>
          <small>{companyName ? `Across ${companyName}` : 'Across your visible channels'}</small>
        </div>
        <span aria-label={`${visibleCount} ${status} threads`} className="track-rail-section-count">{visibleCount}</span>
      </header>
      <div className="track-rail-thread-toolbar">
        <label className="sr-only" htmlFor={searchId}>Search company threads</label>
        <div className="track-rail-thread-search">
          <Search aria-hidden="true" size={13} />
          <Input id={searchId} onChange={(event) => setSearch(event.target.value)} placeholder="Search threads…" value={search} />
        </div>
        <div aria-label="Thread status" className="track-thread-tabs" role="group">
          {(['active', 'archived'] as const).map((value) => (
            <button
              aria-pressed={status === value}
              className={status === value ? 'active' : ''}
              key={value}
              onClick={() => setStatus(value)}
              type="button"
            >
              {value === 'active' ? 'Open' : 'Archived'}
            </button>
          ))}
        </div>
      </div>
      {activeChannel && !readOnly && status === 'active' ? (
        <details className="track-company-thread-create">
          <summary>
            <Plus aria-hidden="true" size={13} />
            Start thread in #{activeChannel.name}
          </summary>
          <form onSubmit={(event) => void submitThread(event)}>
            <label htmlFor={threadNameId}>Thread name</label>
            <Input
              autoComplete="off"
              id={threadNameId}
              maxLength={100}
              name="threadName"
              onChange={(event) => setThreadName(event.target.value)}
              placeholder="For example, Q4 launch risks…"
              required
              value={threadName}
            />
            <Button disabled={saving || !threadName.trim()} size="sm" type="submit">
              {saving ? 'Starting…' : 'Start thread'}
            </Button>
          </form>
        </details>
      ) : null}
      {error ? <p className="track-error" role="alert">{error}. Retry keeps the same request.</p> : null}
      {searchTerm.length === 1 ? (
        <p className="track-rail-empty">Type 1 more character to search all Company threads.</p>
      ) : searching && searchResults === undefined ? (
        <p role="status">Searching all Company threads…</p>
      ) : searching && matchingSearchThreads.length ? (
        <ul aria-label={`${status} Company thread search results`}>
          {matchingSearchThreads.map((item) => (
            <li key={item.threadId}>
              <ThreadLink context={context} groupId={item.groupId} projectId={projectId} threadId={item.threadId}>
                <MessageSquare aria-hidden="true" size={13} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.groupName} · {item.preview}</small>
                </span>
              </ThreadLink>
            </li>
          ))}
        </ul>
      ) : searching ? (
        <p className="track-rail-empty">No matching {status} threads.</p>
      ) : threadPageStatus === 'LoadingFirstPage' ? <p role="status">Loading threads…</p> : visibleThreads.length ? (
        <ul aria-label={`${status} company threads`}>
          {visibleThreads.map((item) => (
            <li key={item.thread._id}>
              <ThreadLink context={context} groupId={item.thread.groupId} projectId={projectId} threadId={item.thread._id}>
                <MessageSquare aria-hidden="true" size={13} />
                <span>
                  <strong>{item.thread.name}</strong>
                  <small>{item.channel?.name ?? 'Channel'} · {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}</small>
                </span>
                {item.unread ? <span aria-label="Unread thread" className="track-unread-marker" role="img" /> : null}
              </ThreadLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="track-rail-empty">No {status} threads.</p>
      )}
      {!searching && (threadPageStatus === 'CanLoadMore' || threadPageStatus === 'LoadingMore') ? (
        <Button
          className="track-rail-load-more"
          disabled={threadPageStatus === 'LoadingMore'}
          onClick={() => loadMoreThreads(40)}
          type="button"
        >
          {threadPageStatus === 'LoadingMore' ? 'Loading…' : 'Load more threads'}
        </Button>
      ) : null}
    </section>
  )
}
