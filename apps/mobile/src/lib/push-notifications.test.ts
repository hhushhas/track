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

  it('opens thread payloads with an exact represented context', () => {
    expect(resolvePushHref({
      url: '/thread?projectId=p&groupId=g&threadId=t&companyId=c&membershipId=m&messageId=x',
    })).toBe('/thread?projectId=p&groupId=g&threadId=t&companyId=c&membershipId=m&messageId=x');
  });

  it('rejects external, incomplete, and membership-ambiguous payloads', () => {
    expect(resolvePushHref({ url: 'https://evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c' })).toBeNull();
    expect(resolvePushHref({ url: '/thread?projectId=p&groupId=g' })).toBeNull();
    expect(resolvePushHref({ url: '/thread?projectId=p&groupId=g&threadId=t&membershipId=m' })).toBeNull();
    expect(resolvePushHref({ url: '//evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
  });
});
