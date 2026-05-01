import { describe, expect, it } from 'vitest'

import { buildChatSearchMatches } from './chat-search'

describe('workspace chat search', () => {
  it('matches message body, author, assistant answer, and draft text', () => {
    const matches = buildChatSearchMatches(
      [
        {
          at: 1,
          kind: 'message',
          key: 'message-1',
          item: {
            message: {
              _id: 'message-1',
              body: 'Please review the client scope.',
            },
            author: {
              displayName: 'Hasan',
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
      ] as Parameters<typeof buildChatSearchMatches>[0],
      'approval',
    )

    expect(matches).toEqual([
      {
        key: 'assistant-1',
        kind: 'assistant',
      },
      {
        key: 'draft-1',
        kind: 'draft',
      },
    ])
  })

  it('returns message ids for message matches', () => {
    expect(
      buildChatSearchMatches(
        [
          {
            at: 1,
            kind: 'message',
            key: 'message-1',
            item: {
              message: {
                _id: 'message-1',
                body: 'Quiet update',
              },
              author: {
                displayName: 'Sam',
              },
            },
          },
        ] as Parameters<typeof buildChatSearchMatches>[0],
        'sam',
      ),
    ).toEqual([
      {
        key: 'message-1',
        kind: 'message',
        messageId: 'message-1',
      },
    ])
  })

  it('ignores blank searches', () => {
    expect(buildChatSearchMatches([], '   ')).toEqual([])
  })
})
