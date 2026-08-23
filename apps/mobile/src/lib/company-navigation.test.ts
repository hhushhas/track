import { describe, expect, it } from 'vitest';

import type { Id } from '../../../../convex/_generated/dataModel';
import { channelHref, navigationUnavailableCopy, projectChannelsHref } from './company-navigation';

describe('Company mobile navigation presenter', () => {
  const projectId = 'project-id' as Id<'projects'>;
  const groupId = 'group-id' as Id<'groups'>;
  const companyId = 'company-id' as Id<'companies'>;
  const membershipId = 'membership-id' as Id<'projectMembers'>;

  it('preserves represented Company membership through Project, Channel, and denied links', () => {
    const context = { archived: false, companyId, membershipId };
    expect(projectChannelsHref(projectId, context)).toContain('companyId=company-id&membershipId=membership-id');
    expect(channelHref(projectId, groupId, context)).toBe('/conversation?groupId=group-id&projectId=project-id&companyId=company-id&membershipId=membership-id');
    expect(channelHref(projectId, groupId, context, 'message-id' as Id<'messages'>)).toBe('/conversation?groupId=group-id&projectId=project-id&companyId=company-id&membershipId=membership-id&messageId=message-id');
    expect(channelHref(projectId, groupId, { archived: true, companyId, membershipId })).toContain('&archive=1');
    expect(navigationUnavailableCopy(true)).not.toContain(groupId);
  });
});
