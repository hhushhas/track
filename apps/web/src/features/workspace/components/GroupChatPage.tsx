import { Fragment } from 'react'
import type { ComponentProps } from 'react'
import type { ClipboardEvent, RefObject } from 'react'
import { AtSign, Bot, ChevronDown, CornerUpLeft, MessagesSquare, Paperclip, Smile, X } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { AttachmentTypeIcon, formatFileSize } from '#/features/workspace/attachment-ui'
import type { createPendingAttachment } from '#/features/workspace/attachments/pending-attachments'
import { getInitials } from '#/features/workspace/identity'
import { formatThreadDayLabel, getThreadDayKey } from '#/features/workspace/lib/thread-date'
import { AssistantAnswer, DraftRecordCard, MessageRow } from '#/features/workspace/thread-items'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import { ThreadDaySeparator } from '#/features/workspace/components/ThreadDaySeparator'
import { TypingIndicatorLine } from '#/features/workspace/typing-indicators'
import {
  VoiceNoteReview,
  VoiceRecorder,
  formatVoiceDuration,
  isVoiceNoteAttachment,
} from '#/features/workspace/voice-notes'
import type { ChatSearchMatch } from '#/features/workspace/search/chat-search'
import type { WorkspaceThreadItem } from '#/features/workspace/search/chat-thread-data'
import type { draftClassifications, draftStatuses } from '#/features/workspace/constants'

type PendingAttachment = ReturnType<typeof createPendingAttachment>
type ActiveTypingIndicator = ComponentProps<typeof TypingIndicatorLine>['indicators'][number]

type MentionOption = {
  id: string
  kind: 'assistant' | 'group' | 'member'
  label: string
  sublabel: string
  handle: string
  tone: string
}

type MentionSection = {
  label: string
  options: Array<MentionOption>
}

type GroupChatPageProps = {
  activeGroup: Doc<'groups'> | undefined
  activeGroupId: Id<'groups'> | null
  activeTypingIndicators: Array<ActiveTypingIndicator>
  busyAction: string | null
  chatSearchMatchKeys: Set<string>
  chatSearchMatches: Array<ChatSearchMatch>
  chatSearchTerm: string
  composer: string
  composerPlaceholder: string
  composerRef: RefObject<HTMLTextAreaElement | null>
  emojiGroups: ReadonlyArray<{
    label: string
    emojis: ReadonlyArray<string>
  }>
  emojiPickerOpen: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  filteredMentionOptions: Array<MentionOption>
  flashingMessageId: string | null
  mentionGroups: Map<string, Doc<'groups'>>
  mentionIndex: number
  mentionOptionRefs: RefObject<Array<HTMLButtonElement | null>>
  mentionSections: Array<MentionSection>
  messageAuthorAvatarUrlById: Map<string, string>
  messageCitations: Map<string, { author: string; body: string; createdAt: number }>
  messagesLoaded: boolean
  onClassifyDraft: (
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) => Promise<void>
  onComposerBlur: () => void
  onComposerChange: (value: string, cursor: number) => void
  onComposerFocus: () => void
  onComposerKeyUp: () => void
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onComposerSelect: () => void
  onEmojiPickerOpenChange: (open: boolean) => void
  onForwardMessage: (input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) => Promise<boolean>
  onInsertComposerText: (text: string) => void
  onMentionIndexChange: (updater: (index: number) => number) => void
  onMentionSelect: (option: MentionOption) => void
  onOpenGroup: (groupId: Id<'groups'>) => void
  onOpenMessageCitation: (messageId: Id<'messages'> | string) => void
  onOpenMessageSource: (groupId: Id<'groups'>, messageId: Id<'messages'>) => void
  onRecordingChange: (recording: boolean) => void
  onReplyMessage: (item: GroupMessageItem) => void
  onReplyToMessageChange: (item: GroupMessageItem | null) => void
  onSendMessage: () => void
  onShowMentionMenuClose: () => void
  onThreadScroll: () => void
  onVoiceNoteRecorded: (recording: { file: File; durationMs: number; previewUrl: string }) => void
  pendingAttachments: Array<PendingAttachment>
  projectMemberRoleByUserId: Map<string, Doc<'projectMembers'>['role']>
  removePendingAttachment: (id: string) => void
  replyToMessage: GroupMessageItem | null
  scrollThreadToLatest: () => void
  setComposerCursorFromRef: () => void
  showJumpToLatest: boolean
  showMentionMenu: boolean
  threadItems: Array<WorkspaceThreadItem>
  threadScrollRef: RefObject<HTMLDivElement | null>
  visibleGroups: Array<Doc<'groups'>>
  visibleMessages: Array<GroupMessageItem>
  voiceRecordingActive: boolean
}

export function GroupChatPage({
  activeGroup,
  activeGroupId,
  activeTypingIndicators,
  busyAction,
  chatSearchMatchKeys,
  chatSearchMatches,
  chatSearchTerm,
  composer,
  composerPlaceholder,
  composerRef,
  emojiGroups,
  emojiPickerOpen,
  fileInputRef,
  filteredMentionOptions,
  flashingMessageId,
  mentionGroups,
  mentionIndex,
  mentionOptionRefs,
  mentionSections,
  messageAuthorAvatarUrlById,
  messageCitations,
  messagesLoaded,
  onClassifyDraft,
  onComposerBlur,
  onComposerChange,
  onComposerFocus,
  onComposerKeyUp,
  onComposerPaste,
  onComposerSelect,
  onEmojiPickerOpenChange,
  onForwardMessage,
  onInsertComposerText,
  onMentionIndexChange,
  onMentionSelect,
  onOpenGroup,
  onOpenMessageCitation,
  onOpenMessageSource,
  onRecordingChange,
  onReplyMessage,
  onReplyToMessageChange,
  onSendMessage,
  onShowMentionMenuClose,
  onThreadScroll,
  onVoiceNoteRecorded,
  pendingAttachments,
  projectMemberRoleByUserId,
  removePendingAttachment,
  replyToMessage,
  scrollThreadToLatest,
  setComposerCursorFromRef,
  showJumpToLatest,
  showMentionMenu,
  threadItems,
  threadScrollRef,
  visibleGroups,
  visibleMessages,
  voiceRecordingActive,
}: GroupChatPageProps) {
  return (
    <>
      <div
        className="track-thread-scroll"
        onScroll={onThreadScroll}
        ref={threadScrollRef}
      >
        <div className="track-thread">
          {activeGroup && messagesLoaded && visibleMessages.length === 0 ? (
            <div className="track-empty-conversation">
              <span className="track-empty-conversation-icon">
                <MessagesSquare size={22} />
              </span>
              <h2>{activeGroup.name} is ready</h2>
              <p>
                Start this group with a decision, question, scope note, or mention @track to turn the first
                useful detail into project memory.
              </p>
            </div>
          ) : null}

          {chatSearchTerm && chatSearchMatches.length === 0 ? (
            <div className="track-empty">
              <p className="mono-label m-0">No matches</p>
              <p>No chat items match "{chatSearchTerm}".</p>
            </div>
          ) : null}

          {threadItems.map((threadItem, index) => {
            const previousThreadItem = threadItems[index - 1]
            const dayKey = getThreadDayKey(threadItem.at)
            const shouldShowDaySeparator =
              !previousThreadItem || getThreadDayKey(previousThreadItem.at) !== dayKey
            const searchQuery = chatSearchMatchKeys.has(threadItem.key) ? chatSearchTerm : undefined
            if (threadItem.kind === 'message') {
              return (
                <Fragment key={threadItem.key}>
                  {shouldShowDaySeparator ? (
                    <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                  ) : null}
                  <MessageRow
                    activeGroupId={activeGroupId}
                    avatarUrl={messageAuthorAvatarUrlById.get(threadItem.item.author?._id ?? '')}
                    busyAction={busyAction}
                    groups={visibleGroups}
                    isFlashing={flashingMessageId === threadItem.item.message._id}
                    item={{
                      ...threadItem.item,
                      authorRole:
                        projectMemberRoleByUserId.get(threadItem.item.author?._id ?? '') ??
                        threadItem.item.authorRole,
                    }}
                    mentionGroups={mentionGroups}
                    onForwardMessage={onForwardMessage}
                    onOpenGroup={onOpenGroup}
                    onOpenMessageSource={onOpenMessageSource}
                    onReplyMessage={onReplyMessage}
                    searchQuery={searchQuery}
                  />
                </Fragment>
              )
            }
            if (threadItem.kind === 'assistant') {
              return (
                <Fragment key={threadItem.key}>
                  {shouldShowDaySeparator ? (
                    <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                  ) : null}
                  <AssistantAnswer
                    mentionGroups={mentionGroups}
                    messageCitations={messageCitations}
                    onOpenGroup={onOpenGroup}
                    onOpenMessageCitation={onOpenMessageCitation}
                    searchQuery={searchQuery}
                    stream={threadItem.stream}
                    threadItemKey={threadItem.key}
                  />
                </Fragment>
              )
            }
            return (
              <Fragment key={threadItem.key}>
                {shouldShowDaySeparator ? (
                  <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                ) : null}
                <DraftRecordCard
                  busy={busyAction === `classify-${threadItem.draft._id}`}
                  draft={threadItem.draft}
                  isSearchActive={chatSearchMatchKeys.has(threadItem.key)}
                  onClassify={onClassifyDraft}
                  searchQuery={searchQuery}
                />
              </Fragment>
            )
          })}
        </div>
        {showJumpToLatest ? (
          <Button
            aria-label="Jump to latest message"
            className="track-jump-latest"
            onClick={scrollThreadToLatest}
            type="button"
          >
            <ChevronDown aria-hidden="true" size={18} />
          </Button>
        ) : null}
      </div>

      <div className="track-composer-wrap">
        <TypingIndicatorLine indicators={activeTypingIndicators} />
        <div className={voiceRecordingActive ? 'track-composer recording' : 'track-composer'}>
          {!voiceRecordingActive && replyToMessage ? (
            <div className="track-composer-quote" aria-label="Replying to message">
              <CornerUpLeft size={14} />
              <span>
                <strong>Replying to {replyToMessage.author?.displayName ?? 'Unknown Member'}</strong>
                <small>{replyToMessage.message.body || 'Attachment message'}</small>
              </span>
              <button
                aria-label="Cancel reply"
                onClick={() => onReplyToMessageChange(null)}
                type="button"
              >
                <X size={13} />
              </button>
            </div>
          ) : null}
          {!voiceRecordingActive && pendingAttachments.length > 0 ? (
            <div className="track-composer-attachments" aria-label="Pending attachments">
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
                    <img alt="" src={attachment.previewUrl} />
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
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {!voiceRecordingActive ? (
            <Textarea
              aria-label={`Message ${activeGroup?.name ?? 'Group'}`}
              disabled={!activeGroupId || busyAction === 'send-message'}
              onBlur={onComposerBlur}
              onChange={(event) => {
                onComposerChange(event.currentTarget.value, event.currentTarget.selectionStart)
                onEmojiPickerOpenChange(false)
              }}
              onFocus={onComposerFocus}
              onKeyDown={(event) => {
                if (emojiPickerOpen && event.key === 'Escape') {
                  event.preventDefault()
                  onEmojiPickerOpenChange(false)
                  return
                }
                if (showMentionMenu) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    onMentionIndexChange((index) => (index + 1) % filteredMentionOptions.length)
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    onMentionIndexChange((index) => (index - 1 + filteredMentionOptions.length) % filteredMentionOptions.length)
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
              placeholder={composerPlaceholder}
              ref={composerRef}
              autoFocus
              value={composer}
            />
          ) : null}
          {!voiceRecordingActive && showMentionMenu ? (
            <div className="track-mention-menu" role="listbox" aria-label="Mention someone">
              {mentionSections.map((section) => (
                <div className="track-mention-section" key={section.label}>
                  <p className="track-mention-section-label">{section.label}</p>
                  {section.options.map((option) => {
                    const index = filteredMentionOptions.findIndex((item) => item.id === option.id)
                    return (
                      <button
                        aria-selected={index === mentionIndex}
                        className={index === mentionIndex ? 'track-mention-option active' : 'track-mention-option'}
                        key={option.id}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          onMentionSelect(option)
                        }}
                        ref={(element) => {
                          mentionOptionRefs.current[index] = element
                        }}
                        role="option"
                        type="button"
                      >
                        <Avatar className={option.tone === 'bot' ? 'track-mention-avatar bot' : `track-mention-avatar ${option.tone}`}>
                          <AvatarFallback>
                            {option.kind === 'assistant' ? (
                              <Bot size={13} />
                            ) : option.kind === 'group' ? (
                              <MessagesSquare size={13} />
                            ) : (
                              getInitials(option.label)
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          <strong>@{option.handle}</strong>
                          <small>{option.label} · {option.sublabel}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : null}
          {!voiceRecordingActive && emojiPickerOpen ? (
            <div className="track-emoji-picker" role="dialog" aria-label="Emoji picker">
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
                          event.preventDefault()
                          onInsertComposerText(emoji)
                          onEmojiPickerOpenChange(false)
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
                className="icon-button"
                disabled={!activeGroupId || busyAction === 'send-message'}
                onClick={() => fileInputRef.current?.click()}
                title="Add attachment"
                type="button"
              >
                <Paperclip size={15} />
              </Button>
            ) : null}
            <VoiceRecorder
              disabled={!activeGroupId || busyAction === 'send-message'}
              onRecordingChange={onRecordingChange}
              onRecorded={onVoiceNoteRecorded}
            />
            {!voiceRecordingActive ? (
              <>
                <Button
                  className="icon-button"
                  disabled={!activeGroupId || busyAction === 'send-message'}
                  onClick={() => {
                    onEmojiPickerOpenChange(false)
                    const cursor = composerRef.current?.selectionStart ?? composer.length
                    const spacer = cursor > 0 && !/\s$/.test(composer.slice(0, cursor)) ? ' @' : '@'
                    const nextComposer = `${composer.slice(0, cursor)}${spacer}${composer.slice(cursor)}`
                    const nextCursor = cursor + spacer.length
                    onComposerChange(nextComposer, nextCursor)
                    requestAnimationFrame(() => {
                      composerRef.current?.focus()
                      composerRef.current?.setSelectionRange(nextCursor, nextCursor)
                    })
                  }}
                  title="Mention"
                  type="button"
                >
                  <AtSign size={15} />
                </Button>
                <Button
                  className="icon-button"
                  disabled={!activeGroupId}
                  onClick={() => {
                    setComposerCursorFromRef()
                    onEmojiPickerOpenChange(!emojiPickerOpen)
                  }}
                  title="Emoji"
                  type="button"
                >
                  <Smile size={15} />
                </Button>
                <span className="track-composer-spacer" />
                <Button
                  className="track-button track-button-primary"
                  disabled={
                    (!composer.trim() && pendingAttachments.length === 0) ||
                    !activeGroupId ||
                    busyAction === 'send-message'
                  }
                  onClick={onSendMessage}
                  type="button"
                >
                  Send
                  <span className="track-send-key">↵</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
