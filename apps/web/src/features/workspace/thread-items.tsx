import { Bot, Check, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { AttachmentTypeIcon, formatFileSize } from './attachment-ui'
import { AvatarNameTooltip } from './avatar-tooltip'
import { draftClassifications, draftStatuses } from './constants'
import { getGroupAvatar } from './group-avatar'
import { getAvatarTone, getInitials } from './identity'
import { MarkdownText } from './markdown'
import { VoiceNotePlayer, isAudioAttachment } from './voice-notes'

export function MessageRow({
  item,
  mentionGroups,
  onOpenGroup,
}: {
  authorRole: Doc<'projectMembers'>['role'] | null
  item: {
    message: Doc<'messages'>
    author: Doc<'users'> | null
    authorRole: Doc<'projectMembers'>['role'] | null
    attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
  }
  mentionGroups: Map<string, Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
}) {
  const authorName = item.author?.displayName ?? 'Unknown Member'
  return (
    <article className="track-message-row" id={`message-${item.message._id}`}>
      <AvatarNameTooltip
        detail={item.authorRole ? item.authorRole.replaceAll('_', ' ') : null}
        name={authorName}
        side="right"
      >
        <Avatar className={`track-message-avatar ${getAvatarTone(item.author?.email ?? authorName)}`}>
          <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
        </Avatar>
      </AvatarNameTooltip>
      <Card className="track-message-body" size="sm">
        <div className="track-message-meta">
          <strong>{authorName}</strong>
          {/*<Badge className="track-role-chip" variant="outline">
            {visibleRole}
          </Badge>*/}
          <time>{new Date(item.message.createdAt).toLocaleTimeString()}</time>
        </div>
        <MarkdownText
          className="track-markdown"
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

export function AssistantAnswer({
  messageCitations,
  mentionGroups,
  onOpenGroup,
  stream,
}: {
  messageCitations: Map<string, { author: string; body: string; createdAt: number }>
  mentionGroups: Map<string, Doc<'groups'>>
  onOpenGroup: (groupId: Id<'groups'>) => void
  stream: { answer: string; createdAt: number; evidence: Array<{ quote: string }>; status: string }
}) {
  const answer =
    stream.answer ||
    (stream.status === 'running' ? 'Track is reviewing the evidence...' : stream.status)
  return (
    <article className="track-assistant-row">
      <AvatarNameTooltip detail="AI review" name="Track Assistant" side="right">
        <Avatar className="track-message-avatar bot">
          <AvatarFallback>
            <Bot size={14} />
          </AvatarFallback>
        </Avatar>
      </AvatarNameTooltip>
      <Card className="track-assistant-body" size="sm">
        <div className="track-message-meta">
          <strong>Track Assistant</strong>
          <time>{new Date(stream.createdAt).toLocaleTimeString()}</time>
        </div>
        <MarkdownText
          className="track-markdown"
          renderCitation={(citationId, index) => (
            <MessageCitation
              citationId={citationId}
              index={index}
              key={`${citationId}-${index}`}
              message={messageCitations.get(citationId)}
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
      </Card>
    </article>
  )
}

function MessageCitation({
  citationId,
  index,
  message,
}: {
  citationId: string
  index: number
  message?: { author: string; body: string; createdAt: number }
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
      onClick={() => {
        document.getElementById(`message-${citationId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }}
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
  onClassify,
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
  onClassify: (
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) => Promise<void>
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
    <Card className="track-draft-record" size="sm">
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
