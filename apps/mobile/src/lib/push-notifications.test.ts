import { describe, expect, it } from 'vitest';

import { resolvePushHref } from './push-routing';

describe('mobile push routing', () => {
  it('opens standalone and exact Company task payloads', () => {
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789' })).toBe('/task?projectId=p&taskKey=T-23456789');
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c&membershipId=m' })).toContain('membershipId=m');
  });

  it('translates existing web message payloads into exact mobile conversation routes', () => {
    expect(resolvePushHref({
      url: '/workspace/projects/p/groups/g', projectId: 'p', groupId: 'g',
    })).toBe('/conversation?projectId=p&groupId=g');
    expect(resolvePushHref({
      url: '/workspace/projects/p/groups/g', projectId: 'p', groupId: 'g',
      companyId: 'c', membershipId: 'm',
    })).toBe('/conversation?projectId=p&groupId=g&companyId=c&membershipId=m');
  });

  it('rejects external, incomplete, and membership-ambiguous payloads', () => {
    expect(resolvePushHref({ url: 'https://evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c' })).toBeNull();
    expect(resolvePushHref({ url: '//evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
  });
});
