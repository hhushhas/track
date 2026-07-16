import { describe, expect, it } from 'vitest';

import { resolvePushHref } from './push-routing';

describe('mobile push routing', () => {
  it('opens standalone and exact Company task payloads', () => {
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789' })).toBe('/task?projectId=p&taskKey=T-23456789');
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c&membershipId=m' })).toContain('membershipId=m');
  });

  it('rejects external, incomplete, and membership-ambiguous payloads', () => {
    expect(resolvePushHref({ url: 'https://evil.example/task?projectId=p&taskKey=T-23456789' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p' })).toBeNull();
    expect(resolvePushHref({ url: '/task?projectId=p&taskKey=T-23456789&companyId=c' })).toBeNull();
  });
});
