type InboxOrderItem = { createdAt: number; eventType: string; kind: string };

function eventPriority(item: InboxOrderItem) {
  if (item.kind === 'message' && item.eventType === 'mention') return 0;
  if (item.kind === 'message' && item.eventType === 'direct_reply') return 1;
  if (item.kind === 'task') return 2;
  if (item.kind === 'message') return 3;
  return 4;
}

/** Keeps date sections chronological and uses event importance only to break ties. */
export function sortInboxItems<T extends InboxOrderItem>(items: readonly T[], isPinned?: (item: T) => boolean) {
  return [...items].sort((left, right) => {
    const pinnedOrder = Number(Boolean(isPinned?.(right))) - Number(Boolean(isPinned?.(left)));
    return pinnedOrder || right.createdAt - left.createdAt || eventPriority(left) - eventPriority(right);
  });
}
