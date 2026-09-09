import { describe, expect, it } from 'vitest';

import {
  attentionContext,
  attentionSection,
  uniqueAttentionItems,
  type MobileAttentionItem,
} from './mobile-attention';

function item(overrides: Partial<MobileAttentionItem> = {}): MobileAttentionItem {
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
  } as MobileAttentionItem;
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
});
