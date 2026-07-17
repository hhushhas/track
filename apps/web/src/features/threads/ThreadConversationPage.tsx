import { parseMentions } from '@track/shared'
import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { getMentionHandle } from '#/features/workspace/identity'
import { MarkdownText } from '#/features/workspace/markdown'
import {
  AssistantInlineTasks,
  CreateTaskFromAssistant,
  CreateTaskFromMessage,
  MessageInlineTasks,
} from '#/features/tasks/ConversationTaskActions'
import { useReleaseConfig } from '#/lib/release-config'
import type { RepresentedThreadContext } from './thread-navigation'

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
  const releaseConfig = useReleaseConfig()
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
  const assistantStreams = useQuery(api.assistant.listForThread, scopedArgs ? { ...scopedArgs, limit: 40 } : 'skip')
  const projectMembers = useQuery(
    api.mobile.listProjectMembers,
    currentUser && navigation?.available
      ? {
          projectId,
          userId: currentUser._id,
          actingCompanyId: context?.actingCompanyId,
          projectMemberId: context?.projectMemberId,
        }
      : 'skip',
  )
  const sendMessage = useMutation(api.messages.send)
  const setFollowing = useMutation(api.channelThreads.setFollowing)
  const markRead = useMutation(api.channelThreads.markRead)
  const setStatus = useMutation(api.channelThreads.setStatus)
  const rename = useMutation(api.channelThreads.rename)
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl)
  const attachFile = useMutation(api.messages.attachFile)
  const createReport = useMutation(api.reports.create)
  const askTrack = useAction(api.assistant.ask)
  const [composer, setComposer] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [replyTo, setReplyTo] = useState<Id<'messages'> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const sendKey = useRef<string | null>(null)

  useEffect(() => {
    if (!scopedArgs || !messages || navigation?.archived) return
    void markRead(scopedArgs).catch(() => undefined)
  }, [markRead, messages, navigation?.archived, scopedArgs])
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

  const memberHandles = useMemo(() => {
    const handles = new Map<string, Array<{
      projectMemberId: Id<'projectMembers'>
      userId: Id<'users'>
    }>>()
    for (const item of projectMembers ?? []) {
      if (!item.user) continue
      const handle = getMentionHandle(item.user.displayName)
      handles.set(handle, [
        ...(handles.get(handle) ?? []),
        { projectMemberId: item.membership._id, userId: item.user._id },
      ])
    }
    return handles
  }, [projectMembers])
  const streamItems = useMemo(() => [
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
  ].sort((a, b) => a.at - b.at), [assistantStreams, messages])

  const backHref = context
    ? `/workspace/company-projects/${projectId}?companyId=${context.actingCompanyId}&membershipId=${context.projectMemberId}&groupId=${groupId}`
    : `/workspace/projects/${projectId}/groups/${groupId}`

  async function submitMessage(event: FormEvent) {
    event.preventDefault()
    if (!currentUser || !thread || thread.thread.status !== 'active') return
    const body = composer.trim()
    if (!body && !attachment) return
    setBusy(true)
    setError(null)
    sendKey.current ??= crypto.randomUUID()
    try {
      const mentionedMembers = parseMentions(body).flatMap((handle) => {
        const matches = memberHandles.get(handle) ?? []
        return matches.length === 1 ? matches : []
      })
      const messageId = await sendMessage({
        projectId,
        groupId,
        channelThreadId: threadId,
        authorId: currentUser._id,
        actingCompanyId: context?.actingCompanyId,
        projectMemberId: context?.projectMemberId,
        idempotencyKey: sendKey.current,
        body,
        mentions: mentionedMembers.map((member) => member.userId),
        mentionedProjectMemberIds: mentionedMembers.map((member) => member.projectMemberId),
        replyToMessageId: replyTo ?? undefined,
        notificationPreview: attachment && !body ? 'Sent an attachment.' : undefined,
      })
      if (attachment) await uploadAttachment(messageId, attachment)
      if (parseMentions(body).includes('track')) {
        await askTrack({
          projectId,
          groupId,
          channelThreadId: threadId,
          requesterId: currentUser._id,
          actingCompanyId: context?.actingCompanyId,
          projectMemberId: context?.projectMemberId,
          promptMessageId: messageId,
          question: body,
        })
      }
      sendKey.current = null
      setComposer('')
      setAttachment(null)
      setReplyTo(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't save")
    } finally {
      setBusy(false)
    }
  }

  async function uploadAttachment(messageId: Id<'messages'>, file: File) {
    if (!currentUser) return
    const uploadUrl = await generateUploadUrl({
      groupId,
      channelThreadId: threadId,
      userId: currentUser._id,
      actingCompanyId: context?.actingCompanyId,
      projectMemberId: context?.projectMemberId,
    })
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!response.ok) throw new Error('upload_failed')
    const { storageId } = await response.json() as { storageId: Id<'_storage'> }
    await attachFile({
      projectId,
      groupId,
      messageId,
      userId: currentUser._id,
      actingCompanyId: context?.actingCompanyId,
      projectMemberId: context?.projectMemberId,
      storageId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      kind: file.type.startsWith('audio/') ? 'voice_note' : 'file',
    })
  }

  async function toggleFollowing() {
    if (!scopedArgs || !thread) return
    setError(null)
    try {
      await setFollowing({ ...scopedArgs, following: !thread.following })
      setNotice(thread.following ? 'Thread unfollowed.' : 'Thread followed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't update follow state")
    }
  }

  async function updateStatus() {
    if (!scopedArgs || !thread) return
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
    }
  }

  async function submitRename(event: FormEvent) {
    event.preventDefault()
    if (!scopedArgs || !thread) return
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
    }
  }

  if (!releaseConfig.threads) return <Unavailable backHref={backHref} />
  if (typeof navigator !== 'undefined' && !navigator.onLine && thread === undefined) {
    return <Unavailable backHref={backHref} detail="You're offline and this thread isn't available on this device." retry />
  }
  if (!currentUser || navigation === undefined || (navigation.available && thread === undefined)) {
    return <main className="track-thread-route"><p role="status">Opening thread…</p></main>
  }
  if (!navigation.available || !thread) return <Unavailable backHref={backHref} />

  const archived = thread.thread.status === 'archived' || navigation.archived
  return (
    <main className="track-thread-route" aria-busy={busy}>
      <header className="track-thread-route-header">
        <a href={backHref}>← Back to Channel</a>
        <div>
          <span className="mono-label">Thread</span>
          <h1>{thread.thread.name}</h1>
          <p>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'} · {thread.following ? 'Following' : 'Not following'}</p>
        </div>
        <div className="track-thread-route-actions">
          {!navigation.archived ? <Button onClick={() => void toggleFollowing()} variant="outline">
            {thread.following ? 'Unfollow' : 'Follow'}
          </Button> : null}
          {thread.canManage && !navigation.archived ? (
            <Button
              onClick={() => void updateStatus()}
              variant="outline"
            >
              {thread.thread.status === 'active' ? 'Archive' : 'Reopen'}
            </Button>
          ) : null}
        </div>
      </header>
      {thread.canManage && !navigation.archived ? (
        <form
          className="track-thread-rename"
          onSubmit={(event) => void submitRename(event)}
        >
          <Input aria-label="Rename thread" maxLength={100} onChange={(event) => setRenameValue(event.target.value)} value={renameValue} />
          <Button type="submit" variant="outline">Rename</Button>
        </form>
      ) : null}
      {thread.source ? (
        <aside className="track-thread-source">
          <strong>Source message</strong>
          {'unavailable' in thread.source ? (
            <p>Source message unavailable.</p>
          ) : (
            <a href={`${backHref}#message-${thread.source.messageId}`}>
              {thread.source.body || 'Attachment message'}
            </a>
          )}
        </aside>
      ) : null}
      {notice ? <p className="track-thread-notice" role="status">{notice}</p> : null}
      {error ? <p className="track-error" role="alert">{error}. Your unsent reply is still here.</p> : null}
      {archived ? <p className="track-thread-archived" role="status">This thread is read-only.</p> : null}
      <section className="track-thread-message-list" role="log" aria-label="Thread messages">
        {messagePageStatus === 'CanLoadMore' ? (
          <Button onClick={() => loadMoreMessages(50)} variant="outline">Load older replies</Button>
        ) : null}
        {streamItems.length === 0 ? <p>{messagePageStatus === 'LoadingFirstPage' ? 'Loading replies…' : 'No replies yet.'}</p> : streamItems.map((entry) => entry.kind === 'assistant' ? (
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
          <article className="track-thread-message" id={`message-${entry.id}`} key={entry.id} tabIndex={-1}>
            <header>
              <strong>{entry.item.author?.displayName ?? 'Unknown member'}</strong>
              <time>{new Date(entry.at).toLocaleString()}</time>
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
              {!archived ? <button onClick={() => setReplyTo(entry.item.message._id)} type="button">Reply</button> : null}
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
      {!archived ? (
        <form className="track-thread-composer" onSubmit={(event) => void submitMessage(event)}>
          {replyTo ? <p>Reply selected. <button onClick={() => setReplyTo(null)} type="button">Cancel</button></p> : null}
          <Textarea aria-label={`Reply in ${thread.thread.name}`} onChange={(event) => setComposer(event.target.value)} placeholder="Reply in thread" value={composer} />
          <input aria-label="Attach a file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} type="file" />
          <Button disabled={busy || (!composer.trim() && !attachment)} type="submit">{busy ? 'Sending…' : 'Send'}</Button>
        </form>
      ) : null}
    </main>
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
