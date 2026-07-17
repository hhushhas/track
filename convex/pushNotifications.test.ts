import { describe, expect, it } from 'vitest'

import { resolveMessageNotificationUrls } from './pushNotifications'

describe('message notification navigation', () => {
  it('routes Company timeline pushes through the represented Company Project', () => {
    expect(resolveMessageNotificationUrls({
      actingCompanyId: 'company-1',
      groupId: 'group-1',
      legacyWebUrl: '/workspace/projects/project-1/groups/group-1',
      messageId: 'message-1',
      projectId: 'project-1',
      projectMemberId: 'membership-1',
    })).toEqual({
      mobileUrl: '/conversation?projectId=project-1&groupId=group-1&companyId=company-1&membershipId=membership-1',
      webUrl: '/workspace/company-projects/project-1?companyId=company-1&membershipId=membership-1&groupId=group-1#message-message-1',
    })
  })

  it('preserves legacy timeline routes without represented context', () => {
    expect(resolveMessageNotificationUrls({
      groupId: 'group-1',
      legacyWebUrl: '/workspace/projects/project-1/groups/group-1',
      messageId: 'message-1',
      projectId: 'project-1',
    }).webUrl).toBe('/workspace/projects/project-1/groups/group-1')
  })
})
