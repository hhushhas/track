import { describe, expect, it } from 'vitest'

import { buildMessageCitations, buildWorkspaceThreadItems } from './chat-thread-data'

describe('workspace chat thread data', () => {
  it('orders messages, assistant streams, and pending drafts chronologically', () => {
    const threadItems = buildWorkspaceThreadItems({
      messages: [
        {
          message: { _id: 'message-2', createdAt: 20 },
          author: null,
        },
        {
          message: { _id: 'message-1', createdAt: 10 },
          author: null,
        },
      ],
      assistantStreams: [{ _id: 'assistant-1', createdAt: 15 }],
      draftRecords: [{ _id: 'draft-1', createdAt: 30 }],
    } as Parameters<typeof buildWorkspaceThreadItems>[0])

    expect(threadItems.map((item) => [item.kind, item.key])).toEqual([
      ['message', 'message-1'],
      ['assistant', 'assistant-1'],
      ['message', 'message-2'],
      ['draft', 'draft-1'],
    ])
  })

  it('builds citation previews with fallback author and truncated body', () => {
    const citations = buildMessageCitations([
      {
        message: {
          _id: 'message-1',
          body: 'a'.repeat(100),
          createdAt: 42,
        },
        author: null,
      },
      {
        message: {
          _id: 'message-2',
          body: 'short body',
          createdAt: 44,
        },
        author: {
          displayName: 'Hasan',
        },
      },
    ] as Parameters<typeof buildMessageCitations>[0])

    expect(citations.get('message-1')).toEqual({
      author: 'Unknown Member',
      body: 'a'.repeat(90),
      createdAt: 42,
    })
    expect(citations.get('message-2')).toEqual({
      author: 'Hasan',
      body: 'short body',
      createdAt: 44,
    })
  })
})
