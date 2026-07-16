import { describe, expect, it } from 'vitest'

import type { Id } from '../../../../../convex/_generated/dataModel'
import { threadHref } from './thread-navigation'

describe('web thread navigation', () => {
  it('uses opaque ids and preserves represented membership context', () => {
    const projectId = 'project' as Id<'projects'>
    const groupId = 'group' as Id<'groups'>
    const threadId = 'thread' as Id<'channelThreads'>
    expect(threadHref(projectId, groupId, threadId)).toBe(
      '/workspace/projects/project/groups/group/threads/thread',
    )
    expect(threadHref(projectId, groupId, threadId, {
      actingCompanyId: 'company' as Id<'companies'>,
      projectMemberId: 'membership' as Id<'projectMembers'>,
    })).toBe(
      '/workspace/projects/project/groups/group/threads/thread?companyId=company&membershipId=membership',
    )
    expect(threadHref(
      projectId,
      groupId,
      threadId,
      {
        actingCompanyId: 'company' as Id<'companies'>,
        projectMemberId: 'membership' as Id<'projectMembers'>,
      },
      'message' as Id<'messages'>,
    )).toBe(
      '/workspace/projects/project/groups/group/threads/thread?companyId=company&membershipId=membership#message-message',
    )
  })
})
