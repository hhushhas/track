import { describe, expect, it } from 'vitest';

import { reconcilePendingMessages, type PendingMessage } from './pending-messages';

describe('reconcilePendingMessages', () => {
  it('keeps a pending row when an older message has the same body', () => {
    const pending: PendingMessage[] = [{ at: 20, body: 'Looks good', id: 'pending-2' }];

    expect(reconcilePendingMessages(pending, new Set(['message-1']))).toBe(pending);
  });

  it('removes only the pending row whose server message ID has arrived', () => {
    const pending: PendingMessage[] = [
      { at: 20, body: 'Looks good', id: 'pending-2', messageId: 'message-2' },
      { at: 30, body: 'Looks good', id: 'pending-3' },
    ];

    expect(reconcilePendingMessages(pending, new Set(['message-1', 'message-2']))).toEqual([
      { at: 30, body: 'Looks good', id: 'pending-3' },
    ]);
  });

  it('keeps the original array when no acknowledged row needs removal', () => {
    const pending: PendingMessage[] = [
      { at: 20, body: 'New message', id: 'pending-2', messageId: 'message-2' },
    ];

    expect(reconcilePendingMessages(pending, new Set(['message-1']))).toBe(pending);
  });
});
