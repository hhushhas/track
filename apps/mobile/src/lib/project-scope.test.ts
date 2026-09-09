import { describe, expect, it } from 'vitest';

import type { Id } from '../../../../convex/_generated/dataModel';
import { findProjectScope } from './project-scope';

const projectId = 'project' as Id<'projects'>;
const firstCompany = 'company-a' as Id<'companies'>;
const secondCompany = 'company-b' as Id<'companies'>;
const firstMembership = 'membership-a' as Id<'projectMembers'>;
const secondMembership = 'membership-b' as Id<'projectMembers'>;

const rows = [
  { project: { _id: projectId }, membership: { _id: firstMembership, companyId: firstCompany } },
  { project: { _id: projectId }, membership: { _id: secondMembership, companyId: secondCompany } },
];

describe('findProjectScope', () => {
  it('selects the exact represented membership when one Project has multiple Company identities', () => {
    expect(findProjectScope(rows, projectId, secondMembership, firstCompany)?.membership._id)
      .toBe(secondMembership);
  });

  it('uses the represented Company when a deep link has no membership ID', () => {
    expect(findProjectScope(rows, projectId, null, secondCompany)?.membership._id)
      .toBe(secondMembership);
  });
});
