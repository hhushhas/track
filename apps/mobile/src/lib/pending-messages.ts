export type PendingMessage = {
  at: number;
  body: string;
  id: string;
  messageId?: string;
};

/** Keep optimistic rows until their exact server message appears in the live page. */
export function reconcilePendingMessages(
  pending: PendingMessage[],
  receivedMessageIds: ReadonlySet<string>,
): PendingMessage[] {
  const next = pending.filter((message) => !message.messageId || !receivedMessageIds.has(message.messageId));
  return next.length === pending.length ? pending : next;
}
