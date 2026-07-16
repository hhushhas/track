import { describe, expect, it } from 'vitest';

import type { Id } from '../../../../convex/_generated/dataModel';
import { channelHref, navigationUnavailableCopy, projectChannelsHref } from './company-navigation';

describe('Company mobile navigation presenter', () => {
  const projectId = 'project-id' as Id<'projects'>;
  const groupId = 'group-id' as Id<'groups'>;
  const companyId = 'company-id' as Id<'companies'>;
  const membershipId = 'membership-id' as Id<'projectMembers'>;

  it('keeps legacy navigation free of represented Company parameters', () => {
    expect(projectChannelsHref(projectId, null)).toBe('/groups?projectId=project-id');
  });

  it('preserves the exact Company membership through Project and Channel links', () => {
    const context = { archived: false, companyId, membershipId };
    expect(projectChannelsHref(projectId, context)).toContain('companyId=company-id&membershipId=membership-id');
    expect(channelHref(projectId, groupId, context)).toBe('/conversation?groupId=group-id&projectId=project-id&companyId=company-id&membershipId=membership-id');
  });

  it('marks exit archives as read-only and presents denied deep links without metadata', () => {
    expect(channelHref(projectId, groupId, { archived: true, companyId, membershipId })).toContain('&archive=1');
    expect(navigationUnavailableCopy(true)).not.toContain(groupId);
  });
});
