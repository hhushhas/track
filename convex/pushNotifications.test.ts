import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveMessageNotificationUrls, sendExpoBatch } from './pushNotifications'

describe('message notification navigation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('routes Company timeline pushes through the represented Company Project', () => {
    expect(resolveMessageNotificationUrls({
      actingCompanyId: 'company-1',
      groupId: 'group-1',
      legacyWebUrl: '/workspace/projects/project-1/groups/group-1',
      messageId: 'message-1',
      projectId: 'project-1',
      projectMemberId: 'membership-1',
    })).toEqual({
      mobileUrl: '/conversation?projectId=project-1&groupId=group-1&companyId=company-1&membershipId=membership-1&messageId=message-1',
      webUrl: '/workspace/company-projects/project-1?companyId=company-1&membershipId=membership-1&groupId=group-1#message-message-1',
    })
  })

  it('preserves legacy timeline routes without represented context', () => {
    expect(resolveMessageNotificationUrls({
      groupId: 'group-1',
      legacyWebUrl: '/workspace/projects/project-1/groups/group-1',
      messageId: 'message-1',
      projectId: 'project-1',
    })).toEqual({
      mobileUrl: '/conversation?projectId=project-1&groupId=group-1&messageId=message-1',
      webUrl: '/workspace/projects/project-1/groups/group-1#message-message-1',
    })
  })

  it('turns malformed successful Expo responses into retryable failures', async () => {
    vi.stubEnv('EXPO_PUSH_ACCESS_TOKEN', 'test-access-token')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('truncated', { status: 200 })))
    const input = {
      token: 'ExponentPushToken[test]',
      title: 'Track',
      body: 'New activity',
      data: { schemaVersion: '1', url: '/projects' },
      soundEnabled: true,
    }
    expect(await sendExpoBatch([input])).toEqual([expect.objectContaining({
      ok: false,
      category: 'network_error',
      permanent: false,
    })])
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})))
    expect(await sendExpoBatch([input])).toEqual([expect.objectContaining({
      ok: false,
      category: 'network_error',
      permanent: false,
    })])
  })
})
