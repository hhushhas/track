import type { Id } from '../../../../convex/_generated/dataModel';

type AttentionContext = {
  companyId?: Id<'companies'>;
  companyName?: string;
  membershipId?: Id<'projectMembers'>;
  projectId?: Id<'projects'>;
  projectName: string;
};

export type MobileAttentionItem = AttentionContext & ({
  kind: 'task';
  id: Id<'taskNotifications'>;
  projectId: Id<'projects'>;
  membershipId: Id<'projectMembers'>;
  taskId?: Id<'tasks'>;
  taskKey: string;
  taskTitle: string;
  eventType: string;
  createdAt: number;
} | {
  kind: 'message';
  id: Id<'messages'>;
  projectId: Id<'projects'>;
  membershipId: Id<'projectMembers'>;
  groupId: Id<'groups'>;
  groupName: string;
  messageId: Id<'messages'>;
  threadId?: Id<'channelThreads'>;
  threadName?: string;
  senderName: string;
  preview: string;
  eventType: string;
  createdAt: number;
} | {
  kind: 'suggestion';
  id: Id<'taskSuggestions'>;
  projectId: Id<'projects'>;
  membershipId: Id<'projectMembers'>;
  title: string;
  preview: string;
  eventType: 'task_suggestion';
  createdAt: number;
} | {
  kind: 'invitation';
  id: Id<'companyInvitations'>;
  invitationId: Id<'companyInvitations'>;
  companyId: Id<'companies'>;
  companyName: string;
  title: string;
  preview: string;
  eventType: 'company_invitation';
  createdAt: number;
});

export type AttentionSectionKey = 'priority' | 'work' | 'following' | 'other';

export function attentionSection(item: MobileAttentionItem): AttentionSectionKey {
  if (item.eventType === 'mention' || item.eventType === 'direct_reply') return 'priority';
  if (item.kind === 'task') return 'work';
  if (item.kind === 'message') return 'following';
  return 'other';
}

export function uniqueAttentionItems(items: MobileAttentionItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.kind === 'task' && item.taskId
      ? `task:${item.taskId}`
      : `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => {
    const order: Record<AttentionSectionKey, number> = { priority: 0, work: 1, following: 2, other: 3 };
    return order[attentionSection(left)] - order[attentionSection(right)] || right.createdAt - left.createdAt;
  });
}

export function attentionTitle(item: MobileAttentionItem) {
  if (item.kind === 'task') return item.taskTitle;
  if (item.kind !== 'message') return item.title;
  return item.eventType === 'mention'
    ? `${item.senderName} mentioned you`
    : item.eventType === 'direct_reply'
      ? `${item.senderName} replied to you`
      : item.eventType === 'thread_activity'
        ? `${item.senderName} added to ${item.threadName ?? 'a thread'}`
        : `${item.senderName} posted in #${item.groupName}`;
}

export function attentionAction(item: MobileAttentionItem) {
  if (item.kind === 'message') {
    if (item.eventType === 'mention') return 'Review mention';
    if (item.eventType === 'direct_reply') return 'Open reply';
    return 'Open discussion';
  }
  if (item.kind === 'suggestion') return 'Review task suggestion';
  if (item.kind === 'invitation') return 'Review Company invitation';
  switch (item.eventType) {
    case 'assignment': return 'Assigned to you';
    case 'assignment_lost': return 'Assignment changed';
    case 'mention': return 'Mentioned on this task';
    case 'due_soon': return 'Due soon';
    case 'overdue': return 'Overdue';
    default: return 'Task updated';
  }
}

export function attentionContext(item: MobileAttentionItem) {
  const parts = [
    item.companyName,
    item.projectName,
    item.kind === 'message' ? `#${item.groupName}` : undefined,
    item.kind === 'task' ? item.taskKey : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.filter((part, index) => parts.indexOf(part) === index).join(' · ');
}

export function relativeAttentionTime(createdAt: number, now = Date.now()) {
  const minutes = Math.max(1, Math.floor((now - createdAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
