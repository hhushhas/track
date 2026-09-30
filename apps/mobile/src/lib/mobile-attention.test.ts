import { describe, expect, it } from 'vitest';

import {
  actionableHomeAttention,
  attentionContext,
  attentionSection,
  conversationNotificationContext,
  conversationNotificationHref,
  conversationNotificationSheetState,
  recentConversationNotifications,
  recentHomeUpdates,
  uniqueAttentionIdentities,
  uniqueAttentionItems,
  type MobileAttentionItem,
} from './mobile-attention';

type MessageAttentionItem = Extract<MobileAttentionItem, { kind: 'message' }>;

function item(overrides: Partial<MessageAttentionItem> = {}): MessageAttentionItem {
  return {
    kind: 'message',
    id: 'message-1' as MobileAttentionItem['id'],
    projectId: 'project-1' as never,
    projectName: 'Launch',
    companyId: 'company-1' as never,
    companyName: 'Company A',
    membershipId: 'member-1' as never,
    groupId: 'group-1' as never,
    groupName: 'mobile',
    messageId: 'message-1' as never,
    senderName: 'Sara',
    preview: 'Please review this.',
    eventType: 'mention',
    createdAt: 1,
    ...overrides,
  } as MessageAttentionItem;
}

describe('mobile attention presentation', () => {
  it('keeps mentions and direct replies in the priority section', () => {
    expect(attentionSection(item())).toBe('priority');
    expect(attentionSection(item({ eventType: 'direct_reply' }))).toBe('priority');
  });

  it('renders the complete Company, Project, and Channel context', () => {
    expect(attentionContext(item())).toBe('Company A · Launch · #mobile');
  });

  it('does not repeat the Company name for Company invitations', () => {
    expect(attentionContext({
      kind: 'invitation',
      id: 'invitation' as never,
      invitationId: 'invitation' as never,
      companyId: 'company' as never,
      companyName: 'Northstar Labs',
      projectName: 'Northstar Labs',
      title: 'Join Northstar Labs',
      preview: 'You were invited as a member.',
      eventType: 'company_invitation',
      createdAt: 1,
    })).toBe('Northstar Labs');
  });

  it('deduplicates repeated notifications for the same task', () => {
    const first = {
      kind: 'task', id: 'notification-1', taskId: 'task-1', taskKey: 'MOB-1', taskTitle: 'Review mobile',
      projectId: 'project-1', projectName: 'Launch', membershipId: 'member-1', eventType: 'assignment', createdAt: 2,
    } as unknown as MobileAttentionItem;
    const second = { ...first, id: 'notification-2', eventType: 'due_soon' } as MobileAttentionItem;
    expect(uniqueAttentionItems([first, second])).toEqual([first]);
  });

  it('deduplicates repeated rows by kind and identity', () => {
    const first = { kind: 'message', id: 'message-1' };
    const duplicate = { kind: 'message', id: 'message-1' };
    const differentKind = { kind: 'task', id: 'message-1' };
    expect(uniqueAttentionIdentities([first, duplicate, differentKind])).toEqual([first, differentKind]);
  });

  it('shows only the newest unique message notifications within the requested limit', () => {
    const older = item({ id: 'older' as never, createdAt: 1 });
    const newer = item({ id: 'newer' as never, createdAt: 3 });
    const duplicate = { ...newer };
    const task = {
      kind: 'task', id: 'task-notification', taskKey: 'MOB-3', taskTitle: 'Review task',
      projectId: 'project-1', projectName: 'Launch', membershipId: 'member-1', eventType: 'assignment', createdAt: 4,
    } as unknown as MobileAttentionItem;

    expect(recentConversationNotifications([older, task, newer, duplicate], 1)).toEqual([newer]);
    expect(recentConversationNotifications([], 12)).toEqual([]);
  });

  it('keeps the notification sheet in loading state until its first page settles', () => {
    expect(conversationNotificationSheetState(true, [item()])).toEqual({ kind: 'loading' });
  });

  it('shows the notification sheet empty state after an empty first page', () => {
    expect(conversationNotificationSheetState(false, [])).toEqual({ kind: 'empty' });
  });

  it('shows sorted notification rows after the first page loads', () => {
    const older = item({ id: 'older' as never, createdAt: 1 });
    const newer = item({ id: 'newer' as never, createdAt: 3 });
    expect(conversationNotificationSheetState(false, [newer, older])).toEqual({ kind: 'items', items: [newer, older] });
  });

  it('uses Channel or Thread context and keeps the notification source in the destination', () => {
    const channel = item();
    const thread = item({ id: 'thread-message' as never, threadId: 'thread-1' as never, threadName: 'Leadership review' });

    expect(conversationNotificationContext(channel)).toBe('Launch · #mobile');
    expect(conversationNotificationContext(thread)).toBe('Launch · #mobile · Thread: Leadership review');
    expect(conversationNotificationHref(channel)).toBe('/conversation?groupId=group-1&projectId=project-1&companyId=company-1&membershipId=member-1&messageId=message-1');
    expect(conversationNotificationHref(thread)).toBe('/thread?projectId=project-1&groupId=group-1&threadId=thread-1&companyId=company-1&membershipId=member-1&messageId=message-1');
  });

  it('keeps Home actionable, priority ordered, and capped at four items', () => {
    const passive = item({ id: 'passive' as never, eventType: 'discussion', createdAt: 99 });
    const reply = item({ id: 'reply' as never, eventType: 'direct_reply', createdAt: 5 });
    const mention = item({ id: 'mention' as never, eventType: 'mention', createdAt: 4 });
    const overdue = {
      kind: 'task', id: 'overdue', taskId: 'task-overdue', taskKey: 'MOB-2', taskTitle: 'Overdue',
      projectId: 'project-1', projectName: 'Launch', membershipId: 'member-1', eventType: 'overdue', createdAt: 3,
    } as unknown as MobileAttentionItem;
    const assignment = {
      ...overdue, id: 'assignment', taskId: 'task-assignment', eventType: 'assignment', createdAt: 6,
    } as MobileAttentionItem;
    const dueSoon = { ...overdue, id: 'due', taskId: 'task-due', eventType: 'due_soon', createdAt: 7 } as MobileAttentionItem;

    expect(actionableHomeAttention([passive, reply, assignment, mention, dueSoon, overdue]).map((entry) => entry.eventType))
      .toEqual(['overdue', 'mention', 'direct_reply', 'due_soon']);
  });

  it('derives recent updates from meaningful scoped feed rows only', () => {
    const passive = item({ id: 'passive' as never, eventType: 'discussion', createdAt: 30 });
    const mention = item({ id: 'mention' as never, eventType: 'mention', createdAt: 20 });
    const overdue = {
      kind: 'task', id: 'overdue', taskId: 'task-overdue', taskKey: 'MOB-2', taskTitle: 'Overdue',
      projectId: 'project-1', projectName: 'Launch', membershipId: 'member-1', eventType: 'overdue', createdAt: 25,
    } as unknown as MobileAttentionItem;
    const assignment = {
      ...overdue, id: 'assignment', taskId: 'task-assignment', eventType: 'assignment', createdAt: 10,
    } as MobileAttentionItem;

    expect(recentHomeUpdates([assignment, passive, overdue, mention])).toEqual([
      expect.objectContaining({ action: 'mention', kind: 'message', title: 'New mention in #mobile' }),
      expect.objectContaining({ action: 'assignment', kind: 'task', title: 'Task assigned to you' }),
    ]);
  });
});
