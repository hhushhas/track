import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Archive, Bell, BellOff, ChevronLeft, FileText, Hash, MessageSquareText, Pencil } from 'lucide-react'

import { api } from '../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import TrackLoader from '#/components/TrackLoader'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Input } from '#/components/ui/input'
import { CompanyProjectNavigation } from '#/features/company/CompanyProjectNavigation'
import type { ConversationComposerReply } from '#/features/workspace/components/ConversationComposer'
import { ScopedConversationComposer } from '#/features/workspace/components/ScopedConversationComposer'
import { MarkdownText } from '#/features/workspace/markdown'
import {
  AssistantInlineTasks,
  CreateTaskFromAssistant,
  CreateTaskFromMessage,
  MessageInlineTasks,
} from '#/features/tasks/ConversationTaskActions'
import { TaskLinkBatchProvider } from '#/features/tasks/task-link-context'
import { useReleaseConfigState } from '#/lib/release-config'
import { companyProjectChannelHref, type RepresentedThreadContext } from './thread-navigation'
import './thread-workspace.css'

export function ThreadConversationPage({
  context,
  groupId,
  projectId,
  threadId,
}: {
  context?: RepresentedThreadContext
  groupId: Id<'groups'>
  projectId: Id<'projects'>
  threadId: Id<'channelThreads'>
}) {
  const releaseState = useReleaseConfigState()
  const releaseConfig = releaseState.config
  const currentUser = useQuery(api.auth.getCurrentUser)
  const navigation = useQuery(
    api.mobile.resolveNavigation,
    currentUser && releaseConfig.threads
      ? {
          projectId,
          groupId,
          userId: currentUser._id,
          actingCompanyId: context?.actingCompanyId,
          projectMemberId: context?.projectMemberId,
        }
      : 'skip',
  )
  const scopedArgs = useMemo(() => currentUser && navigation?.available
    ? {
        threadId,
        userId: currentUser._id,
        actingCompanyId: context?.actingCompanyId,
        projectMemberId: context?.projectMemberId,
      }
    : null, [context?.actingCompanyId, context?.projectMemberId, currentUser, navigation?.available, threadId])
  const thread = useQuery(api.channelThreads.get, scopedArgs ?? 'skip')
  const targetMessageId = typeof window !== 'undefined' && window.location.hash.startsWith('#message-')
    ? decodeURIComponent(window.location.hash.slice('#message-'.length)) as Id<'messages'>
    : undefined
  const {
    results: messages,
    status: messagePageStatus,
    loadMore: loadMoreMessages,
  } = usePaginatedQuery(
    api.channelThreads.listMessagePage,
    scopedArgs ? { ...scopedArgs, targetMessageId } : 'skip',
    { initialNumItems: 50 },
  )
  const assistantPage = usePaginatedQuery(
    api.assistant.listForThreadPage,
    scopedArgs ? { ...scopedArgs, targetMessageId } : 'skip',
    { initialNumItems: 50 },
  )
  const assistantStreams = assistantPage.status === 'LoadingFirstPage' ? undefined : assistantPage.results
  const combinedMessagePageStatus =
    messagePageStatus === 'LoadingFirstPage' || assistantPage.status === 'LoadingFirstPage'
      ? 'LoadingFirstPage'
      : messagePageStatus === 'LoadingMore' || assistantPage.status === 'LoadingMore'
        ? 'LoadingMore'
        : messagePageStatus === 'CanLoadMore' || assistantPage.status === 'CanLoadMore'
          ? 'CanLoadMore'
          : 'Exhausted'
  const timelineBoundary = useMemo(() => {
    const boundaries: number[] = []
    if (messagePageStatus === 'CanLoadMore' || messagePageStatus === 'LoadingMore') {
      const loadedMessageTimes = (messages ?? [])
        .filter((item) => item.message._id !== targetMessageId)
        .map((item) => item.message.createdAt)
      if (loadedMessageTimes.length > 0) boundaries.push(Math.min(...loadedMessageTimes))
    }
    if (assistantPage.status === 'CanLoadMore' || assistantPage.status === 'LoadingMore') {
      const loadedAssistantTimes = (assistantStreams ?? [])
        .filter((item) => item.promptMessageId !== targetMessageId)
        .map((item) => item.createdAt)
      if (loadedAssistantTimes.length > 0) boundaries.push(Math.min(...loadedAssistantTimes))
    }
    return boundaries.length > 0 ? Math.max(...boundaries) : undefined
  }, [assistantPage.status, assistantStreams, messagePageStatus, messages, targetMessageId])
  const channelRows = useQuery(
    api.mobile.listGroups,
    currentUser && navigation?.available
      ? {
          projectId,
          userId: currentUser._id,
          actingCompanyId: context?.actingCompanyId,
          projectMemberId: context?.projectMemberId,
        }
      : 'skip',
  )
  const visibleGroups = useMemo(
    () => (channelRows ?? []).map((row) => row.group),
    [channelRows],
  )
  const activeGroup = visibleGroups.find((group) => group._id === groupId)
  const setFollowing = useMutation(api.channelThreads.setFollowing)
  const markRead = useMutation(api.channelThreads.markRead)
  const setStatus = useMutation(api.channelThreads.setStatus)
  const rename = useMutation(api.channelThreads.rename)
  const deleteMessage = useMutation(api.messages.remove)
  const createReport = useMutation(api.reports.create)
  const [renameValue, setRenameValue] = useState('')
  const [replyTo, setReplyTo] = useState<ConversationComposerReply | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<{ id: Id<'messages'>; preview: string } | null>(null)
  const messageListRef = useRef<HTMLElement | null>(null)
  const historyAnchorRef = useRef<{ height: number; top: number; count: number } | null>(null)
  const viewedSequenceRef = useRef(0)
  const acknowledgedSequenceRef = useRef(0)
  const acknowledgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )
  useEffect(() => {
    if (typeof document === 'undefined') return () => {}
    const handleVisibility = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
  useEffect(() => {
    if (acknowledgeTimeoutRef.current) clearTimeout(acknowledgeTimeoutRef.current)
    acknowledgeTimeoutRef.current = null
    acknowledgedSequenceRef.current = 0
    viewedSequenceRef.current = 0
    historyAnchorRef.current = null
  }, [context?.actingCompanyId, context?.projectMemberId, threadId])
  useEffect(() => {
    if (thread) setRenameValue(thread.thread.name)
  }, [thread])
  useEffect(() => {
    if (!messages || typeof window === 'undefined' || !window.location.hash.startsWith('#message-')) return
    requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
      target?.scrollIntoView({ block: 'center' })
      target?.focus({ preventScroll: true })
    })
  }, [messages])

  const streamItems = useMemo(() => {
    const items = [
      ...[...new Map(
        ((messages ?? []) as Array<ThreadMessageDetail>)
          .map((item) => [item.message._id, item] as const),
      ).values()].map((item) => ({
        at: item.message.createdAt,
        id: item.message._id,
        kind: 'message' as const,
        item,
      })),
      ...((assistantStreams ?? []) as Array<Doc<'assistantStreams'>>).map((item) => ({
        at: item.createdAt,
        id: item._id,
        kind: 'assistant' as const,
        item,
      })),
    ]
    // eslint-disable-next-line unicorn/no-array-sort -- reason: Sort a newly copied array while supporting the web ES2022 target.
    items.sort((a, b) => a.at - b.at)
    return items.filter((entry) =>
      timelineBoundary === undefined ||
      entry.at >= timelineBoundary ||
      (entry.kind === 'message'
        ? entry.item.message._id === targetMessageId
        : entry.item.promptMessageId === targetMessageId),
    )
  }, [assistantStreams, messages, targetMessageId, timelineBoundary])

  const acknowledgeViewedSequence = useCallback((sequence: number) => {
    if (!scopedArgs || !tabVisible || navigation?.readStateImmutable || sequence <= acknowledgedSequenceRef.current) return
    viewedSequenceRef.current = Math.max(viewedSequenceRef.current, sequence)
    if (acknowledgeTimeoutRef.current) return
    acknowledgeTimeoutRef.current = setTimeout(() => {
      acknowledgeTimeoutRef.current = null
      const nextSequence = viewedSequenceRef.current
      if (
        nextSequence <= acknowledgedSequenceRef.current ||
        (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      ) return
      acknowledgedSequenceRef.current = nextSequence
      void markRead({ ...scopedArgs, viewedChannelSequence: nextSequence }).catch(() => {
        acknowledgedSequenceRef.current = Math.min(acknowledgedSequenceRef.current, nextSequence - 1)
      })
    }, 150)
  }, [markRead, navigation?.readStateImmutable, scopedArgs, tabVisible])

  useEffect(() => {
    const list = messageListRef.current
    const messageCount = streamItems.length
    if (!list || !tabVisible || messageCount === 0) return () => {}
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const sequenceValue = entry.target.getAttribute('data-channel-sequence')
        const sequence = sequenceValue ? Number(sequenceValue) : 0
        if (Number.isInteger(sequence) && sequence > 0) acknowledgeViewedSequence(sequence)
      }
    }, { threshold: 0.6 })
    for (const message of list.querySelectorAll<HTMLElement>('[data-channel-sequence]')) {
      observer.observe(message)
    }
    return () => observer.disconnect()
  }, [acknowledgeViewedSequence, streamItems.length, tabVisible])

  const loadMoreThreadMessages = useCallback(() => {
    const list = messageListRef.current
    if (!list || combinedMessagePageStatus !== 'CanLoadMore' || historyAnchorRef.current) return
    historyAnchorRef.current = {
      count: streamItems.length,
      height: list.scrollHeight,
      top: list.scrollTop,
    }
    if (messagePageStatus === 'CanLoadMore') loadMoreMessages(50)
    if (assistantPage.status === 'CanLoadMore') assistantPage.loadMore(50)
  }, [assistantPage, combinedMessagePageStatus, loadMoreMessages, messagePageStatus, streamItems.length])

  useEffect(() => {
    const anchor = historyAnchorRef.current
    if (!anchor || combinedMessagePageStatus === 'LoadingMore' || streamItems.length <= anchor.count) return
    historyAnchorRef.current = null
    requestAnimationFrame(() => {
      const list = messageListRef.current
      if (list) list.scrollTop = anchor.top + (list.scrollHeight - anchor.height)
    })
  }, [combinedMessagePageStatus, streamItems.length])

  useEffect(() => () => {
    if (acknowledgeTimeoutRef.current) clearTimeout(acknowledgeTimeoutRef.current)
  }, [])

  const backHref = context
    ? companyProjectChannelHref(projectId, groupId, context)
    : `/workspace/projects/${projectId}/groups/${groupId}`

  async function removeMessage(messageId: Id<'messages'>) {
    if (!currentUser) return false
    setBusy(true)
    setError(null)
    try {
      await deleteMessage({
        messageId,
        actorId: currentUser._id,
        actingCompanyId: context?.actingCompanyId,
        projectMemberId: context?.projectMemberId,
      })
      if (replyTo?.messageId === messageId) setReplyTo(null)
      setNotice('Message deleted.')
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't delete message")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function toggleFollowing() {
    if (!scopedArgs || !thread) return
    setBusy(true)
    setError(null)
    try {
      await setFollowing({ ...scopedArgs, following: !thread.following })
      setNotice(thread.following ? 'Thread unfollowed.' : 'Thread followed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't update follow state")
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus() {
    if (!scopedArgs || !thread) return
    setBusy(true)
    setError(null)
    try {
      const result = await setStatus({
        ...scopedArgs,
        expectedRevision: thread.thread.revision,
        status: thread.thread.status === 'active' ? 'archived' : 'active',
      })
      setNotice(result.conflict
        ? 'Thread changed elsewhere. Current state has been refreshed.'
        : result.status === 'archived' ? 'Thread archived.' : 'Thread reopened.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't update thread")
    } finally {
      setBusy(false)
    }
  }

  async function submitRename(event: FormEvent) {
    event.preventDefault()
    if (!scopedArgs || !thread) return
    setBusy(true)
    setError(null)
    try {
      const result = await rename({
        ...scopedArgs,
        expectedRevision: thread.thread.revision,
        name: renameValue,
      })
      setNotice(result.conflict
        ? 'Thread changed elsewhere. Current name has been refreshed.'
        : 'Thread renamed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't rename thread")
    } finally {
      setBusy(false)
    }
  }

  if (releaseState.status === 'loading') return <TrackLoader label="Loading thread" />
  if (!releaseConfig.threads) return <Unavailable backHref={backHref} />
  if (typeof navigator !== 'undefined' && !navigator.onLine && thread === undefined) {
    return <Unavailable backHref={backHref} detail="You're offline and this thread isn't available on this device." retry />
  }
  if (!currentUser || navigation === undefined || (navigation.available && thread === undefined)) {
    return <TrackLoader label="Loading thread" />
  }
  if (!navigation.available || !thread) return <Unavailable backHref={backHref} />

  const archived = thread.thread.status === 'archived' || navigation.archived
  const taskLinkMessageIds = streamItems.flatMap((entry) => entry.kind === 'message' ? [entry.item.message._id] : [])
  const taskLinkAssistantStreamIds = streamItems.flatMap((entry) => entry.kind === 'assistant' ? [entry.item._id] : [])
  const conversationContent = (
    <main className="track-thread-route" aria-busy={busy}>
      <header className="track-thread-route-header">
        <a className="track-thread-back" href={backHref}>
          <ChevronLeft aria-hidden="true" size={15} />
          Back to #{activeGroup?.name ?? 'Channel'}
        </a>
        <div className="track-thread-title">
          <span className="mono-label">{navigation.project?.name} / #{activeGroup?.name ?? 'Channel'} / Thread</span>
          <h1>{thread.thread.name}</h1>
          <p>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'} · {thread.following ? 'Following' : 'Not following'}</p>
        </div>
        <div className="track-thread-route-actions">
          {!navigation.archived ? <Button disabled={busy} onClick={() => void toggleFollowing()} variant="outline">
            {thread.following ? <BellOff aria-hidden="true" size={14} /> : <Bell aria-hidden="true" size={14} />}
            {thread.following ? 'Unfollow' : 'Follow'}
          </Button> : null}
          {thread.canManage && !navigation.archived ? (
            <Button
              disabled={busy}
              onClick={() => void updateStatus()}
              variant="outline"
            >
              <Archive aria-hidden="true" size={14} />
              {thread.thread.status === 'active' ? 'Archive' : 'Reopen'}
            </Button>
          ) : null}
        </div>
      </header>
      {notice ? <p className="track-thread-notice" role="status">{notice}</p> : null}
      {error ? <p className="track-error" role="alert">{error}. Your unsent reply is still here.</p> : null}
      {archived ? <p className="track-thread-archived" role="status">This thread is read-only.</p> : null}
      <section
        className="track-thread-message-list"
        ref={(element) => { messageListRef.current = element }}
        role="log"
        aria-label="Thread messages"
      >
        {combinedMessagePageStatus === 'CanLoadMore' ? (
          <Button onClick={loadMoreThreadMessages} variant="outline">Load older replies</Button>
        ) : null}
        {streamItems.length === 0 ? (
          <div className="track-thread-empty" role="status">
            <MessageSquareText aria-hidden="true" size={20} />
            <strong>{messagePageStatus === 'LoadingFirstPage' ? 'Loading replies…' : 'No replies yet'}</strong>
            <span>{messagePageStatus === 'LoadingFirstPage' ? 'The discussion will appear here.' : 'Continue this focused discussion below.'}</span>
          </div>
        ) : streamItems.map((entry) => entry.kind === 'assistant' ? (
          <article className="track-thread-message assistant" key={entry.id}>
            <header>
              <strong>Track Assistant</strong>
              {releaseConfig.tasks && !archived ? (
                <CreateTaskFromAssistant
                  identity={{ actingCompanyId: context?.actingCompanyId, projectMemberId: context?.projectMemberId }}
                  stream={entry.item}
                />
              ) : null}
            </header>
            <MarkdownText text={entry.item.answer || entry.item.status} />
            {releaseConfig.tasks ? (
              <AssistantInlineTasks
                identity={{ actingCompanyId: context?.actingCompanyId, projectMemberId: context?.projectMemberId }}
                stream={entry.item}
              />
            ) : null}
          </article>
        ) : (
          <article
            className="track-thread-message"
            data-channel-sequence={entry.item.message.channelSequence}
            id={`message-${entry.id}`}
            key={entry.id}
            tabIndex={-1}
          >
            <header>
              <strong>{entry.item.author?.displayName ?? 'Unknown member'}</strong>
              <time dateTime={new Date(entry.at).toISOString()}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(entry.at)}</time>
            </header>
            {entry.item.replyTo ? <small>Replying to {entry.item.replyTo.authorName}: {entry.item.replyTo.body}</small> : null}
            <MarkdownText text={entry.item.message.body || 'Attachment message'} />
            {releaseConfig.tasks ? (
              <MessageInlineTasks
                identity={{ actingCompanyId: context?.actingCompanyId, projectMemberId: context?.projectMemberId }}
                message={entry.item.message}
              />
            ) : null}
            {entry.item.attachments.map(({ attachment: file, url }) => url ? (
              <a href={url} key={file._id} rel="noreferrer" target="_blank">{file.filename}</a>
            ) : null)}
            <footer>
              {!archived ? (
                <button
                  onClick={() => setReplyTo({
                    authorName: entry.item.author?.displayName ?? 'Unknown member',
                    body: entry.item.message.body,
                    messageId: entry.item.message._id,
                  })}
                  type="button"
                >
                  Reply
                </button>
              ) : null}
              {!archived &&
                entry.item.message.authorId === currentUser._id &&
                (!context?.projectMemberId ||
                  !entry.item.message.authorProjectMemberId ||
                  entry.item.message.authorProjectMemberId === context.projectMemberId) ? (
                <Button
                  disabled={busy}
                  onClick={() => setPendingDeleteMessage({ id: entry.item.message._id, preview: entry.item.message.body || 'Attachment message' })}
                  variant="destructive"
                >
                  Delete
                </Button>
              ) : null}
              {releaseConfig.tasks && !archived ? (
                <CreateTaskFromMessage
                  identity={{ actingCompanyId: context?.actingCompanyId, projectMemberId: context?.projectMemberId }}
                  message={entry.item.message}
                />
              ) : null}
              <button
                onClick={() => void createReport({
                  projectId,
                  reporterId: currentUser._id,
                  actingCompanyId: context?.actingCompanyId,
                  projectMemberId: context?.projectMemberId,
                  targetType: 'message',
                  targetMessageId: entry.item.message._id,
                  reason: 'other',
                })}
                type="button"
              >Report</button>
            </footer>
          </article>
        ))}
      </section>
      {!archived && activeGroup ? (
        <ScopedConversationComposer
          actorId={currentUser._id}
          channelThreadId={threadId}
          className="track-thread-composer"
          context={context}
          group={activeGroup}
          onBusyChange={(action) => {
            setBusy(Boolean(action))
            if (action) setError(null)
          }}
          onError={(caught) => {
            setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't send reply")
          }}
          onReplyChange={setReplyTo}
          placeholder="Reply in thread. Type @ to tag someone"
          projectId={projectId}
          replyTo={replyTo}
          visibleGroups={visibleGroups}
        />
      ) : null}
      <ConfirmDialog
        confirmLabel="Delete message"
        description={pendingDeleteMessage ? `This removes "${pendingDeleteMessage.preview.slice(0, 120)}${pendingDeleteMessage.preview.length > 120 ? '...' : ''}" from the thread. The action cannot be undone.` : 'This removes the message from the thread. The action cannot be undone.'}
        onConfirm={async () => {
          if (!pendingDeleteMessage) return false
          const messageId = pendingDeleteMessage.id
          const deleted = await removeMessage(messageId)
          if (deleted) setPendingDeleteMessage(null)
          return deleted
        }}
        onOpenChange={(open) => { if (!open) setPendingDeleteMessage(null) }}
        open={Boolean(pendingDeleteMessage)}
        title="Delete this message?"
      />
    </main>
  )

  const conversation = releaseConfig.tasks ? (
    <TaskLinkBatchProvider
      assistantStreamIds={taskLinkAssistantStreamIds}
      identity={{ actingCompanyId: context?.actingCompanyId, projectMemberId: context?.projectMemberId }}
      messageIds={taskLinkMessageIds}
    >
      {conversationContent}
    </TaskLinkBatchProvider>
  ) : conversationContent

  if (!context) return conversation

  return (
    <div className="track-company-thread-workspace company-unified-shell">
      <CompanyProjectNavigation
        actingCompanyId={context.actingCompanyId}
        activeArea="conversation"
        activeProject={{ projectId, projectMemberId: context.projectMemberId, groupId }}
        secondaryNavigation={
          <nav aria-label="Channels">
            <span className="company-project-nav-label">Channels</span>
            <div className="company-project-nav-channel-list">
              {visibleGroups.map((group) => (
                <a
                  aria-current={group._id === groupId ? 'page' : undefined}
                  className={group._id === groupId ? 'company-project-nav-channel active' : 'company-project-nav-channel'}
                  href={companyProjectChannelHref(projectId, group._id, context)}
                  key={group._id}
                >
                  <span className="company-project-nav-channel-icon">
                    <Hash aria-hidden="true" size={14} />
                  </span>
                  <span className="company-project-nav-copy">
                    <strong>{group.name}</strong>
                    <small>{group._id === groupId ? 'Current Channel' : 'Channel'}</small>
                  </span>
                </a>
              ))}
            </div>
          </nav>
        }
        tasksEnabled={releaseConfig.tasks}
      />
      {conversation}
      <aside aria-label="Thread context" className="track-thread-context-rail">
        <header>
          <span className="mono-label">Thread context</span>
          <h2>#{activeGroup?.name ?? 'Channel'}</h2>
          <p>Focused discussion with the same Company, Project, and Channel access.</p>
        </header>
        <section>
          <h3><MessageSquareText aria-hidden="true" size={14} /> Details</h3>
          <dl>
            <div><dt>Status</dt><dd>{archived ? 'Read only' : 'Open'}</dd></div>
            <div><dt>Replies</dt><dd>{thread.replyCount}</dd></div>
            <div><dt>Notifications</dt><dd>{thread.following ? 'Following' : 'Not following'}</dd></div>
          </dl>
        </section>
        <section>
          <h3><FileText aria-hidden="true" size={14} /> Source message</h3>
          {thread.source ? (
            'unavailable' in thread.source ? (
              <p>Source message unavailable.</p>
            ) : (
              <a className="track-thread-source-link" href={`${backHref}#message-${thread.source.messageId}`}>
                {thread.source.body || 'Attachment message'}
              </a>
            )
          ) : <p>This thread started directly in the Channel.</p>}
        </section>
        {thread.canManage && !navigation.archived ? (
          <section>
            <h3><Pencil aria-hidden="true" size={14} /> Rename thread</h3>
            <form className="track-thread-rename" onSubmit={(event) => void submitRename(event)}>
              <label className="sr-only" htmlFor="thread-rename">Thread name</label>
              <Input
                autoComplete="off"
                id="thread-rename"
                maxLength={100}
                name="threadName"
                onChange={(event) => setRenameValue(event.target.value)}
                value={renameValue}
              />
              <Button disabled={busy || !renameValue.trim()} type="submit" variant="outline">Save name</Button>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  )
}

type ThreadMessageDetail = {
  message: Doc<'messages'>
  author: Doc<'users'> | null
  attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
  replyTo: { messageId: Id<'messages'>; authorName: string; body: string; createdAt: number } | null
}

function Unavailable({
  backHref,
  detail = 'Thread unavailable or access changed.',
  retry = false,
}: {
  backHref: string
  detail?: string
  retry?: boolean
}) {
  return <main className="track-thread-route"><h1>Thread unavailable</h1><p>{detail}</p>{retry ? <Button onClick={() => window.location.reload()}>Retry</Button> : null}<a href={backHref}>Back to Channel</a></main>
}
