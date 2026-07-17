import { describe, expect, it } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import { threadConversationHref, threadListHref } from './thread-navigation';

describe('mobile thread navigation', () => {
  it('preserves the exact represented membership in list and conversation links', () => {
    const projectId = 'project' as Id<'projects'>;
    const groupId = 'group' as Id<'groups'>;
    const threadId = 'thread' as Id<'channelThreads'>;
    const sourceMessageId = 'message' as Id<'messages'>;
    const context = {
      companyId: 'company' as Id<'companies'>,
      membershipId: 'membership' as Id<'projectMembers'>,
      archived: false,
    };

    expect(threadListHref(projectId, groupId, context, sourceMessageId))
      .toBe('/threads?projectId=project&groupId=group&companyId=company&membershipId=membership&sourceMessageId=message');
    expect(threadConversationHref(projectId, groupId, threadId, context))
      .toBe('/thread?projectId=project&groupId=group&threadId=thread&companyId=company&membershipId=membership');
    expect(threadConversationHref(projectId, groupId, threadId, context, sourceMessageId))
      .toBe('/thread?projectId=project&groupId=group&threadId=thread&companyId=company&membershipId=membership&messageId=message');
  });
});
