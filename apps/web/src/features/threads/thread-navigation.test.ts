import { describe, expect, it } from 'vitest'

import type { Id } from '../../../../../convex/_generated/dataModel'
import { companyProjectChannelHref, threadHref } from './thread-navigation'

const projectId = 'project-a' as Id<'projects'>
const groupId = 'channel-a' as Id<'groups'>
const threadId = 'thread-a' as Id<'channelThreads'>
const context = {
  actingCompanyId: 'company-a' as Id<'companies'>,
  projectMemberId: 'member-a' as Id<'projectMembers'>,
}

describe('represented thread navigation', () => {
  it('keeps Company and Project membership scope on a thread link', () => {
    expect(threadHref(projectId, groupId, threadId, context)).toBe(
      '/workspace/projects/project-a/groups/channel-a/threads/thread-a?companyId=company-a&membershipId=member-a',
    )
  })

  it('returns to the exact Channel conversation instead of the Project default', () => {
    expect(companyProjectChannelHref(projectId, groupId, context)).toBe(
      '/workspace/company-projects/project-a?companyId=company-a&groupId=channel-a&membershipId=member-a&view=channels',
    )
  })

  it('keeps message focus in a represented thread link', () => {
    expect(threadHref(
      projectId,
      groupId,
      threadId,
      context,
      'message-a' as Id<'messages'>,
    )).toBe(
      '/workspace/projects/project-a/groups/channel-a/threads/thread-a?companyId=company-a&membershipId=member-a#message-message-a',
    )
  })
})
