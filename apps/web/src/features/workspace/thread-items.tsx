import {
  Check,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  MoreHorizontal,
  Paperclip,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Textarea } from '#/components/ui/textarea'
import { AttachmentTypeIcon, formatFileSize } from './attachment-ui'
import { AvatarNameTooltip } from './avatar-tooltip'
import { draftClassifications, draftStatuses } from './constants'
import { getGroupAvatar } from './group-avatar'
import { getAvatarTone, getInitials } from './identity'
import { MarkdownText } from './markdown'
import { VoiceNotePlayer, isAudioAttachment } from './voice-notes'

export type ReplyToMessagePreview = {
  messageId: Id<'messages'>
  authorName: string
  body: string
  createdAt: number
}

export type ForwardedMessagePreview = {
  originalAuthorName: string
  originalBody: string
  originalCreatedAt: number
  attachmentSnapshots: Array<{
    filename: string
    contentType: string
    size: number
    kind?: Doc<'attachments'>['kind']
    durationMs?: number
  }>
  forwardedAt: number
  canOpenSource: boolean
  sourceGroupId: Id<'groups'> | null
  sourceMessageId: Id<'messages'> | null
  sourceGroupName: string | null
}

export type GroupMessageItem = {
  message: Doc<'messages'>
  author: Doc<'users'> | null
  authorRole: Doc<'projectMembers'>['role'] | null
  attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
  replyTo: ReplyToMessagePreview | null
  forwardedFrom: ForwardedMessagePreview | null
}

export function getForwardedSourceLabel(forwarded: Pick<ForwardedMessagePreview, 'sourceGroupName'>) {
  return forwarded.sourceGroupName ? `Forwarded from ${forwarded.sourceGroupName}` : 'Forwarded message'
}

export function formatCopiedAttachmentCount(count: number) {
  return `${count} attachment${count === 1 ? '' : 's'} copied`
}

export function MessageRow({
  activeGroupId,
  busyAction,
  groups,
  isFlashing,
  item,
  mentionGroups,
  onForwardMessage,
  onOpenGroup,
  onOpenMessageSource,
  onReplyMessage,
  searchQuery,
}: {
  activeGroupId: Id<'groups'> | null
  busyAction: string | null
  groups: Array<Doc<'groups'>>
  isFlashing?: boolean
  item: GroupMessageItem
  mentionGroups: Map<string, Doc<'groups'>>
  onForwardMessage: (input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) => Promise<boolean>
  onOpenGroup: (groupId: Id<'groups'>) => void
  onOpenMessageSource: (groupId: Id<'groups'>, messageId: Id<'messages'>) => void
  onReplyMessage: (item: GroupMessageItem) => void
  searchQuery?: string
}) {
  const authorName = item.author?.displayName ?? 'Unknown Member'
  const canForward = groups.some((group) => group._id !== item.message.groupId)
  return (
    <article
      className={isFlashing ? 'track-message-row flashing' : 'track-message-row'}
      data-thread-item-key={item.message._id}
      id={`message-${item.message._id}`}
    >
      <AvatarNameTooltip
        bio={item.author?.profileBio}
        detail={item.author?.profileDesignation ?? (item.authorRole ? item.authorRole.replaceAll('_', ' ') : null)}
        name={authorName}
        side="right"
        timezone={item.author?.timezone}
      >
        <Avatar className={`track-message-avatar ${getAvatarTone(item.author?.email ?? authorName)}`}>
          <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
        </Avatar>
      </AvatarNameTooltip>
      <Card className="track-message-body" size="sm">
        <MessageActions
          activeGroupId={activeGroupId}
          busyAction={busyAction}
          canForward={canForward}
          groups={groups}
          item={item}
          onForwardMessage={onForwardMessage}
          onReplyMessage={onReplyMessage}
        />
        <div className="track-message-meta">
          <strong>{authorName}</strong>
          {/*<Badge className="track-role-chip" variant="outline">
            {visibleRole}
          </Badge>*/}
          <time>{new Date(item.message.createdAt).toLocaleTimeString()}</time>
        </div>
        {item.replyTo ? <QuotedMessageBlock quote={item.replyTo} /> : null}
        {item.forwardedFrom ? (
          <ForwardedMessageBlock
            forwarded={item.forwardedFrom}
            onOpenSource={onOpenMessageSource}
          />
        ) : null}
        <MarkdownText
          className="track-markdown"
          highlightQuery={searchQuery}
          renderMention={(handle, index) => (
            <MentionInline
              handle={handle}
              index={index}
              mentionGroups={mentionGroups}
              onOpenGroup={onOpenGroup}
            />
          )}
          text={item.message.body}
        />
        {item.attachments.length > 0 ? (
          <div className="track-attachment-list">
            {item.attachments.map(({ attachment, url }) => {
              const isImage = attachment.contentType.startsWith('image/')
              if (isAudioAttachment(attachment)) {
                return (
                  <VoiceNotePlayer
                    contentType={attachment.contentType}
                    durationMs={attachment.durationMs}
                    filename={attachment.filename}
                    kind={attachment.kind}
                    key={attachment._id}
                    size={attachment.size}
                    url={url}
                  />
                )
              }
              const content = isImage ? (
                <>
                  {url ? (
                    <img alt={attachment.filename} src={url} />
                  ) : (
                    <span className="track-attachment-file-icon">
                      <AttachmentTypeIcon
                        contentType={attachment.contentType}
                        filename={attachment.filename}
                        size={16}
                      />
                    </span>
                  )}
                  <span>
                    <strong>{attachment.filename}</strong>
                    <small>{formatFileSize(attachment.size)}</small>
                  </span>
                </>
              ) : (
                <>
                  <span className="track-attachment-file-icon">
                    <AttachmentTypeIcon
                      contentType={attachment.contentType}
                      filename={attachment.filename}
                      size={16}
                    />
                  </span>
                  <span>
                    <strong>{attachment.filename}</strong>
                    <small>{formatFileSize(attachment.size)}</small>
                  </span>
                </>
              )

              return url ? (
                <a
                  className={isImage ? 'track-attachment-card image' : 'track-attachment-card file'}
                  href={url}
                  key={attachment._id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {content}
                </a>
              ) : (
                <span
                  className={isImage ? 'track-attachment-card image' : 'track-attachment-card file'}
                  key={attachment._id}
                >
                  {content}
                </span>
              )
            })}
          </div>
        ) : null}
      </Card>
    </article>
  )
}

function MessageActions({
  activeGroupId,
  busyAction,
  canForward,
  groups,
  item,
  onForwardMessage,
  onReplyMessage,
}: {
  activeGroupId: Id<'groups'> | null
  busyAction: string | null
  canForward: boolean
  groups: Array<Doc<'groups'>>
  item: GroupMessageItem
  onForwardMessage: (input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) => Promise<boolean>
  onReplyMessage: (item: GroupMessageItem) => void
}) {
  return (
    <div className="track-message-actions" aria-label="Message actions">
      <Button
        aria-label="Reply to message"
        className="icon-button track-message-action-button"
        onClick={() => onReplyMessage(item)}
        title="Reply"
        type="button"
      >
        <CornerUpLeft size={14} />
      </Button>
      <ForwardMessagePopover
        activeGroupId={activeGroupId}
        busyAction={busyAction}
        canForward={canForward}
        groups={groups}
        item={item}
        onForwardMessage={onForwardMessage}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="More message actions"
              className="icon-button track-message-action-button"
              title="More"
              type="button"
            />
          }
        >
          <MoreHorizontal size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="track-message-menu">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                const text = item.message.body || item.forwardedFrom?.originalBody || ''
                if (text) void navigator.clipboard?.writeText(text)
              }}
            >
              Copy text
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ForwardMessagePopover({
  activeGroupId,
  busyAction,
  canForward,
  groups,
  item,
  onForwardMessage,
}: {
  activeGroupId: Id<'groups'> | null
  busyAction: string | null
  canForward: boolean
  groups: Array<Doc<'groups'>>
  item: GroupMessageItem
  onForwardMessage: (input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [activeTargetIndex, setActiveTargetIndex] = useState(0)
  const targetButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const targetGroups = groups
    .filter((group) => group._id !== item.message.groupId)
    .filter((group) => group.name.toLowerCase().includes(query.trim().toLowerCase()))
  const isForwarding = busyAction === `forward-${item.message._id}`
  useEffect(() => {
    setActiveTargetIndex(0)
  }, [query, open])
  useEffect(() => {
    targetButtonRefs.current = targetButtonRefs.current.slice(0, targetGroups.length)
  }, [targetGroups.length])
  async function handleForward(targetGroupId: Id<'groups'>) {
    const forwarded = await onForwardMessage({
      sourceMessageId: item.message._id,
      targetGroupId,
      body: note,
    })
    if (!forwarded) return
    setOpen(false)
    setQuery('')
    setNote('')
  }
  function focusTargetAt(index: number) {
    if (targetGroups.length === 0) return
    const nextIndex = (index + targetGroups.length) % targetGroups.length
    setActiveTargetIndex(nextIndex)
    targetButtonRefs.current[nextIndex]?.focus()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!activeGroupId || !canForward}
        render={
          <Button
            aria-label="Forward message"
            className="icon-button track-message-action-button"
            title="Forward"
            type="button"
          />
        }
      >
        <CornerUpRight size={14} />
      </PopoverTrigger>
      <PopoverContent align="end" className="track-forward-popover" side="top" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>Forward to Group</PopoverTitle>
          <PopoverDescription>Send a copied snapshot with an optional note.</PopoverDescription>
        </PopoverHeader>
        <div className="track-forward-search">
          <Search size={13} />
          <Input
            aria-label="Search Groups"
            autoComplete="off"
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                focusTargetAt(0)
              }
            }}
            placeholder="Search groups..."
            value={query}
          />
        </div>
        <ForwardPreview item={item} />
        <Textarea
          aria-label="Optional forwarding note"
          className="track-forward-note"
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="Add a note for this Group..."
          value={note}
        />
        <div
          aria-label="Groups you can forward to"
          className="track-forward-targets"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              focusTargetAt(activeTargetIndex + 1)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              focusTargetAt(activeTargetIndex - 1)
              return
            }
            if (event.key === 'Home') {
              event.preventDefault()
              focusTargetAt(0)
              return
            }
            if (event.key === 'End') {
              event.preventDefault()
              focusTargetAt(targetGroups.length - 1)
            }
          }}
          role="listbox"
        >
          {targetGroups.length > 0 ? (
            targetGroups.map((group, index) => {
              const { Icon, tone } = getGroupAvatar(group)
              return (
                <button
                  aria-label={`Forward to ${group.name}`}
                  aria-selected={activeTargetIndex === index}
                  className="track-forward-target"
                  disabled={isForwarding}
                  key={group._id}
                  onClick={() => void handleForward(group._id)}
                  onFocus={() => setActiveTargetIndex(index)}
                  ref={(node) => {
                    targetButtonRefs.current[index] = node
                  }}
                  role="option"
                  tabIndex={index === activeTargetIndex ? 0 : -1}
                  type="button"
                >
                  <span className={`track-nav-group-icon ${tone}`}>
                    <Icon size={14} />
                  </span>
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.kind.replaceAll('_', ' ')} Group</small>
                  </span>
                  <CornerUpRight size={13} />
                </button>
              )
            })
          ) : (
            <div className="track-forward-empty">
              <strong>No Groups available</strong>
              <span>You need access to another Group where you can send messages.</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function QuotedMessageBlock({ quote }: { quote: ReplyToMessagePreview }) {
  return (
    <div className="track-message-quote">
      <span>{quote.authorName}</span>
      <p>{quote.body || 'Attachment message'}</p>
    </div>
  )
}

function ForwardPreview({ item }: { item: GroupMessageItem }) {
  const authorName = item.author?.displayName ?? 'Unknown Member'
  const attachmentCount = item.attachments.length
  return (
    <div className="track-forward-preview">
      <span>{authorName}</span>
      <p>{item.message.body || 'Attachment message'}</p>
      {attachmentCount > 0 ? (
        <small>
          <Paperclip size={12} />
            {attachmentCount} attachment{attachmentCount === 1 ? '' : 's'} will be copied
        </small>
      ) : null}
    </div>
  )
}

function ForwardedMessageBlock({
  forwarded,
  onOpenSource,
}: {
  forwarded: ForwardedMessagePreview
  onOpenSource: (groupId: Id<'groups'>, messageId: Id<'messages'>) => void
}) {
  const attachmentCount = forwarded.attachmentSnapshots.length
  const sourceLabel = getForwardedSourceLabel(forwarded)
  return (
    <div className="track-forwarded-block">
      <div className="track-forwarded-label">
        <CornerUpRight size={13} />
        <span>{sourceLabel}</span>
      </div>
      <div className="track-forwarded-card">
        <span>{forwarded.originalAuthorName} · {new Date(forwarded.originalCreatedAt).toLocaleTimeString()}</span>
        <p>{forwarded.originalBody || 'Attachment message'}</p>
        {attachmentCount > 0 ? (
          <small>
            <Paperclip size={12} />
            {formatCopiedAttachmentCount(attachmentCount)}
          </small>
        ) : null}
      </div>
      {forwarded.canOpenSource && forwarded.sourceGroupId && forwarded.sourceMessageId ? (
        <button
          className="track-forwarded-source"
          onClick={() => onOpenSource(forwarded.sourceGroupId as Id<'groups'>, forwarded.sourceMessageId as Id<'messages'>)}
          type="button"
        >
          <ExternalLink size={12} />
          View source
        </button>
      ) : (
        <span className="track-forwarded-source muted">
          <X size={12} />
          Source restricted
        </span>
      )}
    </div>
  )
}

export function AssistantAnswer({
  messageCitations,
  mentionGroups,
  onOpenGroup,
  onOpenMessageCitation,
  searchQuery,
  stream,
  threadItemKey,
}: {
  messageCitations: Map<string, { author: string; body: string; createdAt: number }>
  mentionGroups: Map<string, Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
  onOpenMessageCitation: (messageId: Id<'messages'> | string) => void
  searchQuery?: string
  stream: { answer: string; createdAt: number; evidence: Array<{ quote: string }>; status: string }
  threadItemKey: string
}) {
  const isThinking = stream.status === 'running' && !stream.answer
  const answer = stream.answer || stream.status
  return (
    <article className="track-assistant-row" data-thread-item-key={threadItemKey}>
      <AvatarNameTooltip detail="AI review" name="Track Assistant" side="right">
        <Avatar className="track-message-avatar bot">
          <AvatarFallback>T</AvatarFallback>
        </Avatar>
      </AvatarNameTooltip>
      <div className="track-assistant-body">
        <div className="track-message-meta">
          <strong>Track Assistant</strong>
          <time>{new Date(stream.createdAt).toLocaleTimeString()}</time>
        </div>
        {isThinking ? (
          <TextShimmer>Thinking</TextShimmer>
        ) : (
          <MarkdownText
            className="track-markdown"
            highlightQuery={searchQuery}
            renderCitation={(citationId, index) => (
              <MessageCitation
                citationId={citationId}
                index={index}
                key={`${citationId}-${index}`}
                message={messageCitations.get(citationId)}
                onOpen={onOpenMessageCitation}
              />
            )}
            renderMention={(handle, index) => (
              <MentionInline
                handle={handle}
                index={index}
                mentionGroups={mentionGroups}
                onOpenGroup={onOpenGroup}
              />
            )}
            text={answer}
          />
        )}
      </div>
    </article>
  )
}

function TextShimmer({ children }: { children: string }) {
  return (
    <span className="track-text-shimmer" aria-label={children}>
      {children}
    </span>
  )
}

function MessageCitation({
  citationId,
  index,
  message,
  onOpen,
}: {
  citationId: string
  index: number
  message?: { author: string; body: string; createdAt: number }
  onOpen: (messageId: Id<'messages'> | string) => void
}) {
  if (!message) {
    return (
      <span className="track-citation-chip" key={`${citationId}-${index}`}>
        source
      </span>
    )
  }

  return (
    <button
      className="track-citation-chip"
      key={`${citationId}-${index}`}
      onClick={() => onOpen(citationId)}
      type="button"
    >
      <span className="track-citation-source">
        {message.author} ·{' '}
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}
      </span>
      <span className="track-citation-preview">{message.body || 'Attachment message'}</span>
    </button>
  )
}

function MentionInline({
  handle,
  index,
  mentionGroups,
  onOpenGroup,
}: {
  handle: string
  index: number
  mentionGroups: Map<string, Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
}) {
  const group = mentionGroups.get(handle)
  if (group) {
    const { Icon, tone } = getGroupAvatar(group)
    return (
      <button
        className={`track-mention-inline group ${tone}`}
        key={`${handle}-${index}`}
        onClick={() => onOpenGroup(group._id)}
        type="button"
      >
        <Icon size={12} />
        @{handle}
      </button>
    )
  }

  return (
    <span
      className={handle === 'track' ? 'track-mention-inline track' : 'track-mention-inline'}
      key={`${handle}-${index}`}
    >
      @{handle}
    </span>
  )
}

export function DraftRecordCard({
  busy,
  draft,
  isSearchActive,
  onClassify,
  searchQuery,
}: {
  busy: boolean
  draft: {
    _id: Id<'draftRecords'>
    type: string
    title: string
    description: string
    proposedStatus: string
    evidence: Array<{ quote: string }>
  }
  isSearchActive?: boolean
  onClassify: (
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) => Promise<void>
  searchQuery?: string
}) {
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description)
  const [status, setStatus] = useState<(typeof draftStatuses)[number]>(
    draftStatuses.includes(draft.proposedStatus as (typeof draftStatuses)[number])
      ? (draft.proposedStatus as (typeof draftStatuses)[number])
      : 'open',
  )

  useEffect(() => {
    setTitle(draft.title)
    setDescription(draft.description)
    setStatus(
      draftStatuses.includes(draft.proposedStatus as (typeof draftStatuses)[number])
        ? (draft.proposedStatus as (typeof draftStatuses)[number])
        : 'open',
    )
  }, [draft.description, draft.proposedStatus, draft.title])

  const updates = { title, description, status }
  return (
    <Card
      className={isSearchActive ? 'track-draft-record search-active' : 'track-draft-record'}
      data-thread-item-key={draft._id}
      size="sm"
    >
      <header>
        <span className="track-draft-kicker">
          <Sparkles size={13} />
          AI Draft Record · Awaiting Staff Review
        </span>
        <span className="track-record-id">DR-{draft._id.slice(-3).toUpperCase()} · detected</span>
      </header>
      <div className="track-draft-content">
        <Input
          aria-label="Draft record title"
          className="track-draft-title-input"
          disabled={busy}
          onChange={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        {isSearchActive && searchQuery?.trim() ? (
          <span className="track-draft-search-hint">
            Search match in draft title or summary
          </span>
        ) : null}
        <dl className="track-draft-meta">
          <dt>Type</dt>
          <dd>
            <Badge className="track-type-pill" variant="outline">
              <span className="track-type-dot" />
              {draft.type.replaceAll('_', ' ')}
            </Badge>
          </dd>
          <dt>Status</dt>
          <dd>
            <NativeSelect
              aria-label="Draft record status"
              disabled={busy}
              onChange={(event) => setStatus(event.currentTarget.value as typeof status)}
              value={status}
            >
              {draftStatuses.map((draftStatus) => (
                <NativeSelectOption key={draftStatus} value={draftStatus}>
                  {draftStatus.replaceAll('_', ' ')}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </dd>
        </dl>
        <label className="track-draft-field">
          <Textarea
            aria-label="Draft record summary"
            disabled={busy}
            onChange={(event) => setDescription(event.currentTarget.value)}
            value={description}
          />
        </label>
        <div className="track-evidence-note">
          <span className="track-evidence-title">
            Evidence · {draft.evidence.length || 1} source messages
          </span>
          <div className="track-evidence-list">
            {(draft.evidence.length ? draft.evidence : [{ quote: 'Source messages attached' }])
              .slice(0, 3)
              .map((item, index) => (
                <div className="track-evidence-item" key={`${item.quote}-${index}`}>
                  <strong>Source</strong>
                  <span>{item.quote}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="track-classify-block">
          <div className="track-classify-row">
            {draftClassifications.map((classification, index) => (
              <Button
                className={index === 0 ? 'track-classify-chip suggested' : 'track-classify-chip'}
                disabled={busy}
                key={classification}
                onClick={() => void onClassify(draft._id, classification, updates)}
                type="button"
              >
                <span className={`track-classify-dot ${classification}`} />
                {classification.replaceAll('_', ' ')}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <footer>
        <span className="track-draft-footer-spacer" />
        <Button
          className="track-draft-save"
          disabled={busy}
          onClick={() => void onClassify(draft._id, 'billable_scope', updates)}
          type="button"
        >
          <Check size={14} />
          Save as Record
        </Button>
      </footer>
    </Card>
  )
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="track-count-cell">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
