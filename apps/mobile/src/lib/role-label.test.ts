import { describe, expect, it } from 'vitest';

import { channelRoleLabel, companyRoleLabel, projectRoleLabel } from './role-label';

describe('role labels', () => {
  it('uses only the approved Company labels', () => {
    expect(companyRoleLabel('owner')).toBe('Company Owner');
    expect(companyRoleLabel('admin')).toBe('Company Admin');
    expect(companyRoleLabel('manager')).toBe('Company Member');
  });

  it('normalizes compatibility project roles', () => {
    expect(projectRoleLabel('manager')).toBe('Project Member');
    expect(projectRoleLabel('client')).toBe('Project Member');
  });

  it('uses the approved Channel labels', () => {
    expect(channelRoleLabel(true)).toBe('Channel Manager');
    expect(channelRoleLabel(false)).toBe('Channel Member');
  });
});
