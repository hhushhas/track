import { describe, expect, it } from 'vitest';

import { resolvePushHref } from './push-routing';

describe('mobile push routing', () => {
  it('accepts safe internal URLs and rejects external URL schemes', () => {
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789' })).toBe('/task?projectId=p&taskKey=T-23456789');
    expect(resolvePushHref({ url: 'https://evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
    expect(resolvePushHref({ url: '//evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
  });

  it('rejects represented payloads without a complete Company membership', () => {
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c' })).toBeNull();
    expect(resolvePushHref({ url: '/thread?projectId=p&groupId=g&threadId=t&membershipId=m' })).toBeNull();
    expect(resolvePushHref({ url: '/conversation?projectId=p&groupId=g&companyId=c' })).toBeNull();
  });
});
