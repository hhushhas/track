import { CornerUpLeft, CornerUpRight, MoreHorizontal, Paperclip, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Button } from '#/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '#/components/ui/popover'
import { Textarea } from '#/components/ui/textarea'
import type { TaskIdentity } from '#/features/tasks/task-types'
import type { GroupMessageItem, ReplyToMessagePreview } from '../thread-item-components'
import { getGroupAvatar } from '../group-avatar'
import type { GroupReference } from '../group-types'
import { CreateTaskFromMessage } from '#/features/tasks/ConversationTaskActions'

export function MessageActions({
  activeGroupId,
  busyAction,
  canDelete,
  canForward,
  canReply = true,
  canCreateTasks = true,
  groups,
  identity,
  item,
  linkedTasks,
  onDeleteMessage,
  onForwardMessage,
  onReplyMessage,
}: {
  activeGroupId: Id<'groups'> | null
  busyAction: string | null
  canDelete: boolean
  canForward: boolean
  canReply?: boolean
  canCreateTasks?: boolean
  groups: Array<GroupReference>
  identity?: TaskIdentity
  item: GroupMessageItem
  linkedTasks?: ReadonlyArray<{ task: { publicKey: string; title: string } }>
  onDeleteMessage: (messageId: Id<'messages'>) => Promise<boolean>
  onForwardMessage: (input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) => Promise<boolean>
  onReplyMessage: (item: GroupMessageItem) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  function selectMessageText() {
    const messageNode = document.getElementById(`message-${String(item.message._id)}`)?.querySelector('.track-markdown')
    if (!messageNode) return
    const range = document.createRange()
    range.selectNodeContents(messageNode)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  return (
    <div className="track-message-actions" aria-label="Message actions">
      {canReply ? (
        <Button
          aria-label="Reply to message"
          className="icon-button track-message-action-button"
          onClick={() => onReplyMessage(item)}
          title="Reply"
          type="button"
        >
          <CornerUpLeft size={14} />
        </Button>
      ) : null}
      <ForwardMessagePopover
        activeGroupId={activeGroupId}
        busyAction={busyAction}
        canForward={canForward}
        groups={groups}
        item={item}
        onForwardMessage={onForwardMessage}
      />
      {canCreateTasks ? <CreateTaskFromMessage identity={identity} message={item.message} /> : null}
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
            <DropdownMenuItem onClick={selectMessageText}>Select message</DropdownMenuItem>
            {linkedTasks?.length ? (
              <DropdownMenuItem
                onClick={() => {
                  const task = linkedTasks[0]?.task
                  if (!task) return
                  const identityQuery = identity?.actingCompanyId && identity.projectMemberId
                    ? `&actingCompanyId=${identity.actingCompanyId}&projectMemberId=${identity.projectMemberId}`
                    : ''
                  const taskUrl = `${window.location.origin}/workspace/projects/${item.message.projectId}/tasks?view=board&task=${encodeURIComponent(task.publicKey)}&groupId=${encodeURIComponent(String(item.message.groupId))}${identityQuery}`
                  void navigator.clipboard?.writeText(taskUrl)
                }}
              >
                Copy task link
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                disabled={busyAction === `delete-${item.message._id}`}
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                <Trash2 />
                Delete message
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        confirmLabel="Delete message"
        description="This removes the message from the conversation. The action cannot be undone."
        onConfirm={() => onDeleteMessage(item.message._id)}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Delete this message?"
      />
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
  groups: Array<GroupReference>
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
            placeholder="Search groups…"
            value={query}
          />
        </div>
        <ForwardPreview item={item} />
        <Textarea
          aria-label="Optional forwarding note"
          className="track-forward-note"
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="Add a note for this Group…"
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

export function QuotedMessageBlock({ quote }: { quote: ReplyToMessagePreview }) {
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
