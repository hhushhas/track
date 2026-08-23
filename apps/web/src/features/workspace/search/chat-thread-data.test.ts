import { describe, expect, it } from 'vitest'

import { buildWorkspaceThreadItems } from './chat-thread-data'

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
})
