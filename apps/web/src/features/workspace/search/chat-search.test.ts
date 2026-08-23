import { describe, expect, it } from 'vitest'

import { buildChatSearchMatches } from './chat-search'

describe('workspace chat search', () => {
  it('matches mixed thread fields and ignores blank searches', () => {
    const threadItems = [
      {
        at: 1,
        kind: 'message',
        key: 'message-1',
        item: {
          message: {
            _id: 'message-1',
            body: 'Please review the approval scope.',
          },
          author: {
            displayName: 'Sam',
          },
        },
      },
      {
        at: 2,
        kind: 'assistant',
        key: 'assistant-1',
        stream: {
          answer: 'The risk is missing approval.',
        },
      },
      {
        at: 3,
        kind: 'draft',
        key: 'draft-1',
        draft: {
          title: 'Follow up',
          description: 'Approval is pending.',
        },
      },
    ] as Parameters<typeof buildChatSearchMatches>[0]

    expect(buildChatSearchMatches(threadItems, 'approval')).toEqual([
      {
        key: 'message-1',
        kind: 'message',
        messageId: 'message-1',
      },
      {
        key: 'assistant-1',
        kind: 'assistant',
      },
      {
        key: 'draft-1',
        kind: 'draft',
      },
    ])

    expect(buildChatSearchMatches(threadItems, 'sam')).toEqual([
      {
        key: 'message-1',
        kind: 'message',
        messageId: 'message-1',
      },
    ])

    expect(buildChatSearchMatches(threadItems, '   ')).toEqual([])
  })
})
