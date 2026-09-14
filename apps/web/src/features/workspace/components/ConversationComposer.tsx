import { AtSign, Bot, CornerUpLeft, Import, MessagesSquare, Paperclip, Smile, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ClipboardEvent, ComponentProps, RefObject } from 'react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { MentionListbox } from '#/components/ui/mention-listbox'
import { Textarea } from '#/components/ui/textarea'
import { AttachmentTypeIcon, formatFileSize } from '#/features/workspace/attachment-ui'
import type { PendingWorkspaceAttachment } from '#/features/workspace/hooks/usePendingAttachments'
import { getInitials } from '#/features/workspace/identity'
import type {
  WorkspaceMentionOption,
  WorkspaceMentionSection,
} from '#/features/workspace/lib/mentions'
import { TypingIndicatorLine } from '#/features/workspace/typing-indicators'
import {
  VoiceNoteReview,
  VoiceRecorder,
  formatVoiceDuration,
  isVoiceNoteAttachment,
} from '#/features/workspace/voice-notes'
import { cn } from '#/lib/utils'

type ActiveTypingIndicator = ComponentProps<typeof TypingIndicatorLine>['indicators'][number]

export type ConversationComposerReply = {
  authorName: string
  body: string
  messageId: Id<'messages'>
}

export type ConversationComposerProps = {
  activeTypingIndicators?: Array<ActiveTypingIndicator>
  ariaLabel: string
  available: boolean
  busyAction: string | null
  className?: string
  composer: string
  composerRef: RefObject<HTMLTextAreaElement | null>
  contentLocked?: boolean
  emojiGroups: ReadonlyArray<{
    label: string
    emojis: ReadonlyArray<string>
  }>
  emojiPickerOpen: boolean
  filteredMentionOptions: Array<WorkspaceMentionOption>
  mentionIndex: number
  mentionOptionRefs: RefObject<Array<HTMLButtonElement | null>>
  mentionSections: Array<WorkspaceMentionSection>
  onAddAttachment: () => void
  onComposerBlur: () => void
  onComposerChange: (value: string, cursor: number) => void
  onComposerFocus: () => void
  onComposerKeyUp: () => void
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onComposerSelect: () => void
  onEmojiPickerOpenChange: (open: boolean) => void
  onInsertComposerText: (text: string) => void
  onMentionIndexChange: (updater: (index: number) => number) => void
  onMentionSelect: (option: WorkspaceMentionOption) => void
  onOpenMemoryImport: () => void
  onRecordingChange: (recording: boolean) => void
  onReplyChange: (reply: ConversationComposerReply | null) => void
  onSendMessage: () => void
  onShowMentionMenuClose: () => void
  onVoiceNoteRecorded: (recording: {
    file: File
    durationMs: number
    previewUrl: string
  }) => void
  pendingAttachments: Array<PendingWorkspaceAttachment>
  placeholder: string
  removePendingAttachment: (id: string) => void
  replyTo: ConversationComposerReply | null
  sendLabel?: string
  setComposerCursorFromRef: () => void
  showMentionMenu: boolean
  voiceRecordingActive: boolean
}

export function ConversationComposer({
  activeTypingIndicators = [],
  ariaLabel,
  available,
  busyAction,
  className,
  composer,
  composerRef,
  contentLocked = false,
  emojiGroups,
  emojiPickerOpen,
  filteredMentionOptions,
  mentionIndex,
  mentionOptionRefs,
  mentionSections,
  onAddAttachment,
  onComposerBlur,
  onComposerChange,
  onComposerFocus,
  onComposerKeyUp,
  onComposerPaste,
  onComposerSelect,
  onEmojiPickerOpenChange,
  onInsertComposerText,
  onMentionIndexChange,
  onMentionSelect,
  onOpenMemoryImport,
  onRecordingChange,
  onReplyChange,
  onSendMessage,
  onShowMentionMenuClose,
  onVoiceNoteRecorded,
  pendingAttachments,
  placeholder,
  removePendingAttachment,
  replyTo,
  sendLabel = 'Send',
  setComposerCursorFromRef,
  showMentionMenu,
  voiceRecordingActive,
}: ConversationComposerProps) {
  const mentionMenuVisible = showMentionMenu && !emojiPickerOpen
  const composingRef = useRef(false)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const emojiTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (emojiPickerOpen) {
      requestAnimationFrame(() => emojiPickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus())
      return
    }
    if (document.activeElement !== composerRef.current) emojiTriggerRef.current?.focus()
  }, [composerRef, emojiPickerOpen])

  function insertEmoji(emoji: string) {
    onInsertComposerText(emoji)
    onEmojiPickerOpenChange(false)
  }

  return (
    <div aria-busy={Boolean(busyAction)} className={cn('track-composer-wrap', className)}>
      <TypingIndicatorLine indicators={activeTypingIndicators} />
      <div className={voiceRecordingActive ? 'track-composer recording' : 'track-composer'}>
        {!voiceRecordingActive && replyTo ? (
          <div aria-label="Replying to message" className="track-composer-quote">
            <CornerUpLeft aria-hidden="true" size={14} />
            <span>
              <strong>Replying to {replyTo.authorName}</strong>
              <small>{replyTo.body}</small>
            </span>
            <button
              aria-label="Cancel reply"
              onClick={() => onReplyChange(null)}
              type="button"
            >
              <X aria-hidden="true" size={13} />
            </button>
          </div>
        ) : null}
        {!voiceRecordingActive && pendingAttachments.length > 0 ? (
          <div aria-label="Pending attachments" className="track-composer-attachments">
            {pendingAttachments.map((attachment) => (
              <div
                className={
                  attachment.kind === 'voice_note'
                    ? 'track-composer-attachment voice'
                    : 'track-composer-attachment'
                }
                key={attachment.id}
              >
                {attachment.kind === 'voice_note' && attachment.previewUrl ? (
                  <VoiceNoteReview
                    durationMs={attachment.durationMs}
                    file={attachment.file}
                    onRemove={() => removePendingAttachment(attachment.id)}
                    previewUrl={attachment.previewUrl}
                  />
                ) : attachment.previewUrl ? (
                  <img alt="" height={42} src={attachment.previewUrl} width={42} />
                ) : (
                  <span className="track-composer-file-icon">
                    <AttachmentTypeIcon
                      contentType={attachment.file.type}
                      filename={attachment.file.name}
                      size={18}
                    />
                  </span>
                )}
                {attachment.kind === 'voice_note' ? null : (
                  <>
                    <span className="track-composer-attachment-meta">
                      <strong>{attachment.file.name}</strong>
                      <small>
                        {isVoiceNoteAttachment({
                          contentType: attachment.file.type,
                          filename: attachment.file.name,
                          kind: attachment.kind,
                        })
                          ? formatVoiceDuration(attachment.durationMs)
                          : formatFileSize(attachment.file.size)}
                      </small>
                    </span>
                    <button
                      aria-label={`Remove ${attachment.file.name}`}
                      className="track-composer-attachment-remove"
                      onClick={() => removePendingAttachment(attachment.id)}
                      type="button"
                    >
                      <X aria-hidden="true" size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}
        {!voiceRecordingActive ? (
          <Textarea
            aria-activedescendant={mentionMenuVisible ? `composer-mention-option-${mentionIndex}` : undefined}
            aria-label={ariaLabel}
            aria-controls={mentionMenuVisible ? 'composer-mention-options' : undefined}
            aria-expanded={mentionMenuVisible}
            aria-autocomplete="list"
            disabled={!available || contentLocked || busyAction === 'send-message'}
            onBlur={onComposerBlur}
            onChange={(event) => {
              onComposerChange(event.currentTarget.value, event.currentTarget.selectionStart)
              onEmojiPickerOpenChange(false)
            }}
            onFocus={onComposerFocus}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            onKeyDown={(event) => {
              if (composingRef.current || event.nativeEvent.isComposing) return
              if (emojiPickerOpen && event.key === 'Escape') {
                event.preventDefault()
                onEmojiPickerOpenChange(false)
                return
              }
              if (mentionMenuVisible) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  onMentionIndexChange((index) => (index + 1) % filteredMentionOptions.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  onMentionIndexChange(
                    (index) =>
                      (index - 1 + filteredMentionOptions.length) % filteredMentionOptions.length,
                  )
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  const option = filteredMentionOptions[mentionIndex] ?? filteredMentionOptions[0]
                  if (option) onMentionSelect(option)
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onShowMentionMenuClose()
                  return
                }
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSendMessage()
              }
            }}
            onKeyUp={onComposerKeyUp}
            onPaste={onComposerPaste}
            onSelect={onComposerSelect}
            placeholder={placeholder}
            ref={composerRef}
            role="combobox"
            value={composer}
          />
        ) : null}
        {!voiceRecordingActive && mentionMenuVisible ? (
          <MentionListbox
            activeIndex={mentionIndex}
            ariaLabel="Mention someone"
            className="track-mention-menu"
            getKey={(option) => option.id}
            id="composer-mention-options"
            onSelect={onMentionSelect}
            optionIdPrefix="composer-mention-option"
            optionRefs={mentionOptionRefs}
            renderOption={(option) => (
              <>
                <Avatar
                  className={
                    option.tone === 'bot'
                      ? 'track-mention-avatar bot'
                      : `track-mention-avatar ${option.tone}`
                  }
                >
                  <AvatarFallback>
                    {option.kind === 'assistant' ? (
                      <Bot aria-hidden="true" size={13} />
                    ) : option.kind === 'group' ? (
                      <MessagesSquare aria-hidden="true" size={13} />
                    ) : (
                      getInitials(option.label)
                    )}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <strong>@{option.handle}</strong>
                  <small>
                    {option.label} · {option.sublabel}
                  </small>
                </span>
              </>
            )}
            sections={mentionSections}
          />
        ) : null}
        {!voiceRecordingActive && emojiPickerOpen ? (
          <div
            aria-label="Emoji picker"
            aria-modal="true"
            className="track-emoji-picker"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onEmojiPickerOpenChange(false)
              }
            }}
            ref={emojiPickerRef}
            role="dialog"
            tabIndex={-1}
          >
            {emojiGroups.map((group) => (
              <div className="track-emoji-group" key={group.label}>
                <p className="mono-label m-0">{group.label}</p>
                <div className="track-emoji-grid">
                  {group.emojis.map((emoji) => (
                    <button
                      aria-label={`Insert ${emoji}`}
                      className="track-emoji-option"
                      key={`${group.label}-${emoji}`}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return
                        event.preventDefault()
                        insertEmoji(emoji)
                      }}
                      onClick={(event) => {
                        if (event.detail === 0) insertEmoji(emoji)
                      }}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="track-composer-bar">
          {!voiceRecordingActive ? (
            <Button
              aria-label="Add attachment"
              className="icon-button"
              disabled={!available || contentLocked || busyAction === 'send-message'}
              onClick={onAddAttachment}
              title="Add attachment"
              type="button"
            >
              <Paperclip aria-hidden="true" size={15} />
            </Button>
          ) : null}
          {!voiceRecordingActive ? (
              <div aria-label="Message options" className="track-composer-more-menu" role="group">
                <Button aria-label="Import project memory" className="icon-button" disabled={!available || contentLocked || busyAction === 'memory-import'} onClick={onOpenMemoryImport} title="Import project memory" type="button"><Import aria-hidden="true" size={15} /></Button>
                <VoiceRecorder disabled={!available || contentLocked || busyAction === 'send-message'} onRecordingChange={onRecordingChange} onRecorded={onVoiceNoteRecorded} />
                <Button aria-label="Mention" className="icon-button" disabled={!available || contentLocked || busyAction === 'send-message'} onClick={() => {
                  onEmojiPickerOpenChange(false)
                  const cursor = composerRef.current?.selectionStart ?? composer.length
                  const spacer = cursor > 0 && !/\s$/.test(composer.slice(0, cursor)) ? ' @' : '@'
                  const nextComposer = `${composer.slice(0, cursor)}${spacer}${composer.slice(cursor)}`
                  const nextCursor = cursor + spacer.length
                  onComposerChange(nextComposer, nextCursor)
                  requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(nextCursor, nextCursor) })
                }} title="Mention" type="button"><AtSign aria-hidden="true" size={15} /></Button>
                <Button aria-label="Emoji" className="icon-button" disabled={!available || contentLocked} onClick={() => { setComposerCursorFromRef(); onEmojiPickerOpenChange(!emojiPickerOpen) }} ref={emojiTriggerRef} title="Emoji" type="button"><Smile aria-hidden="true" size={15} /></Button>
              </div>
          ) : null}
          {!voiceRecordingActive ? (
            <>
              <span className="track-composer-spacer" />
              <Button
                className="track-button track-button-primary"
                disabled={
                  (!composer.trim() && pendingAttachments.length === 0) ||
                  !available ||
                  busyAction === 'send-message'
                }
                onClick={onSendMessage}
                type="button"
              >
                {sendLabel}
                <span className="track-send-key">↵</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
