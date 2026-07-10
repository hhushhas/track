import { describe, expect, it } from 'vitest'

import { buildMessageCitations, buildWorkspaceThreadItems } from './chat-thread-data'

describe('workspace chat thread data', () => {
  it('orders messages and assistant streams chronologically', () => {
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
    } as Parameters<typeof buildWorkspaceThreadItems>[0])

    expect(threadItems.map((item) => [item.kind, item.key])).toEqual([
      ['message', 'message-1'],
      ['assistant', 'assistant-1'],
      ['message', 'message-2'],
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
        attachments: [],
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
        attachments: [
          {
            attachment: {
              _id: 'attachment-1',
              contentType: 'application/pdf',
              filename: 'proposal.pdf',
              kind: 'file',
              size: 2048,
            },
          },
        ],
      },
    ] as Parameters<typeof buildMessageCitations>[0])

    expect(citations.get('message-1')).toEqual({
      author: 'Unknown Member',
      attachments: [],
      body: 'a'.repeat(90),
      createdAt: 42,
    })
    expect(citations.get('message-2')).toEqual({
      author: 'Hasan',
      attachments: [
        {
          id: 'attachment-1',
          contentType: 'application/pdf',
          filename: 'proposal.pdf',
          kind: 'file',
          size: 2048,
        },
      ],
      body: 'short body',
      createdAt: 44,
    })
  })
})
