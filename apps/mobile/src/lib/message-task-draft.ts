import type { Id } from '../../../../convex/_generated/dataModel';

export function messageTaskDraft(body: string, messageId: Id<'messages'>, actionKey: string) {
  return {
    idempotencyKey: `message-task:${actionKey}`,
    references: [{ type: 'message' as const, messageId, isPrimary: true }],
    title: body.trim().slice(0, 180) || 'Follow up',
  };
}
