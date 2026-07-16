import { useMutation, useQuery } from 'convex/react'
import { useMemo, useRef, useState, type FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useReleaseConfig } from '#/lib/release-config'
import { threadHref, type RepresentedThreadContext } from './thread-navigation'

type TimelineMessage = {
  message: {
    _id: Id<'messages'>
    body: string
    createdAt: number
  }
  author: { displayName: string } | null
  channelThread?: { threadId: Id<'channelThreads'> } | null
}

export function ChannelThreadBrowser({
  context,
  groupId,
  projectId,
  readOnly,
  timelineMessages,
  userId,
}: {
  context?: RepresentedThreadContext
  groupId: Id<'groups'>
  projectId: Id<'projects'>
  readOnly: boolean
  timelineMessages: Array<TimelineMessage>
  userId: Id<'users'>
}) {
  const releaseConfig = useReleaseConfig()
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [name, setName] = useState('')
  const [sourceMessageId, setSourceMessageId] = useState<Id<'messages'> | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const idempotencyKey = useRef<string | null>(null)
  const queryArgs = releaseConfig.threads
    ? {
        groupId,
        userId,
        status,
        actingCompanyId: context?.actingCompanyId,
        projectMemberId: context?.projectMemberId,
      }
    : 'skip'
  const threads = useQuery(api.channelThreads.list, queryArgs)
  const createThread = useMutation(api.channelThreads.create)
  const availableSources = useMemo(
    () => timelineMessages.filter((item) => !item.channelThread),
    [timelineMessages],
  )

  if (!releaseConfig.threads) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    idempotencyKey.current ??= crypto.randomUUID()
    try {
      const threadId = await createThread({
        projectId,
        groupId,
        creatorId: userId,
        actingCompanyId: context?.actingCompanyId,
        projectMemberId: context?.projectMemberId,
        idempotencyKey: idempotencyKey.current,
        name,
        sourceMessageId: sourceMessageId || undefined,
      })
      idempotencyKey.current = null
      window.location.assign(threadHref(projectId, groupId, threadId, context))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="track-channel-threads" aria-label="Channel threads">
      <header>
        <div>
          <span className="mono-label">Threads</span>
          <p>Focused conversations with the same Channel access.</p>
        </div>
        <div className="track-thread-tabs" role="tablist" aria-label="Thread status">
          {(['active', 'archived'] as const).map((value) => (
            <button
              aria-selected={status === value}
              className={status === value ? 'active' : ''}
              key={value}
              onClick={() => setStatus(value)}
              role="tab"
              type="button"
            >
              {value === 'active' ? 'Active' : 'Archived'}
            </button>
          ))}
        </div>
      </header>

      {threads === undefined ? (
        <p role="status">Loading threads…</p>
      ) : threads.length === 0 ? (
        <p className="track-thread-empty">No {status} threads.</p>
      ) : (
        <ul className="track-thread-list">
          {threads.map((item) => (
            <li key={item.thread._id}>
              <a href={threadHref(projectId, groupId, item.thread._id, context)}>
                <span>
                  <strong>{item.thread.name}</strong>
                  <small>
                    {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
                    {item.following ? ' · Following' : ''}
                  </small>
                </span>
                {item.unread ? <b aria-label="Unread thread">Unread</b> : null}
              </a>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && status === 'active' ? (
        <form className="track-thread-create" onSubmit={(event) => void submit(event)}>
          <Input
            aria-label="Thread name"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder="Thread name"
            required
            value={name}
          />
          <label>
            <span className="sr-only">Optional source message</span>
            <select
              aria-label="Optional source message"
              onChange={(event) => setSourceMessageId(event.target.value as Id<'messages'> | '')}
              value={sourceMessageId}
            >
              <option value="">Start directly in this Channel</option>
              {availableSources.map((item) => (
                <option key={item.message._id} value={item.message._id}>
                  {item.author?.displayName ?? 'Unknown member'}: {item.message.body || 'Attachment message'}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={saving || !name.trim()} type="submit">
            {saving ? 'Starting…' : 'Start thread'}
          </Button>
        </form>
      ) : null}
      {error ? <p className="track-error" role="alert">{error}. Retry keeps the same request.</p> : null}
    </section>
  )
}
