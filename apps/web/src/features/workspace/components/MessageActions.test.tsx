import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { GroupMessageItem } from '../thread-item-components'
import { MessageActions } from './MessageActions'

vi.mock('#/features/tasks/ConversationTaskActions', () => ({
  CreateTaskFromMessage: () => null,
}))

const messageId = 'message-id' as Id<'messages'>
const projectId = 'project-id' as Id<'projects'>
const groupId = 'group-id' as Id<'groups'>
const authorId = 'author-id' as Id<'users'>
const item = {
  message: {
    _id: messageId,
    _creationTime: 1,
    projectId,
    groupId,
    authorId,
    body: 'Message body',
    mentions: [],
    attachmentIds: [],
    createdAt: 1,
  } as Doc<'messages'>,
  author: null,
  authorRole: null,
  attachments: [],
  replyTo: null,
  forwardedFrom: null,
  channelThread: null,
} satisfies GroupMessageItem

function renderActions({
  canDelete,
  onDeleteMessage = vi.fn(async () => true),
}: {
  canDelete: boolean
  onDeleteMessage?: (messageId: Id<'messages'>) => Promise<boolean>
}) {
  render(
    <MessageActions
      activeGroupId={item.message.groupId}
      busyAction={null}
      canDelete={canDelete}
      canForward={false}
      groups={[]}
      item={item}
      onDeleteMessage={onDeleteMessage}
      onForwardMessage={vi.fn(async () => true)}
      onReplyMessage={vi.fn()}
    />,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MessageActions', () => {
  it('does not offer deletion for another member’s message', async () => {
    renderActions({ canDelete: false })

    fireEvent.click(screen.getByRole('button', { name: 'More message actions' }))

    expect(await screen.findByText('Copy text')).toBeTruthy()
    expect(screen.queryByText('Delete message')).toBeNull()
  })

  it('requires confirmation before deleting the author’s message', async () => {
    const onDeleteMessage = vi.fn(async () => true)
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderActions({ canDelete: true, onDeleteMessage })

    fireEvent.click(screen.getByRole('button', { name: 'More message actions' }))
    fireEvent.click(await screen.findByText('Delete message'))
    expect(onDeleteMessage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'More message actions' }))
    fireEvent.click(await screen.findByText('Delete message'))

    await waitFor(() => expect(onDeleteMessage).toHaveBeenCalledWith(messageId))
  })
})
