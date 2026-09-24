/** Canonical mobile labels. Persisted compatibility roles never leak into UI copy. */
export function companyRoleLabel(role?: string | null) {
  if (role === 'owner') return 'Company Owner';
  if (role === 'admin') return 'Company Admin';
  return 'Company Member';
}

export function projectRoleLabel(role?: string | null) {
  return role === 'owner' ? 'Project Owner' : 'Project Member';
}

export function channelRoleLabel(isManager: boolean) {
  return isManager ? 'Channel Manager' : 'Channel Member';
}
