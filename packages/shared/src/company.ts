export const companyStatuses = ['active', 'suspended', 'closed'] as const
export type CompanyStatus = (typeof companyStatuses)[number]

export const companyRoles = ['owner', 'admin', 'member'] as const
export type CompanyRole = (typeof companyRoles)[number]

export const companyMemberStatuses = ['active', 'suspended', 'removed'] as const
export type CompanyMemberStatus = (typeof companyMemberStatuses)[number]

export const invitationStatuses = [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
] as const
export type InvitationStatus = (typeof invitationStatuses)[number]

export const relationshipStatuses = ['forming', 'active', 'inactive', 'closed'] as const
export type RelationshipStatus = (typeof relationshipStatuses)[number]

export const relationshipCompanyStatuses = ['active', 'left', 'removed'] as const
export type RelationshipCompanyStatus = (typeof relationshipCompanyStatuses)[number]

export const approvalRequestStatuses = [
  'pending',
  'approved',
  'cancelled',
  'stale',
  'expired',
] as const
export type ApprovalRequestStatus = (typeof approvalRequestStatuses)[number]

export const approvalDecisions = ['approved', 'rejected'] as const
export type ApprovalDecision = (typeof approvalDecisions)[number]

export const projectOrigins = ['single_company', 'shared'] as const
export type ProjectOrigin = (typeof projectOrigins)[number]

export const projectStatuses = [
  'proposed',
  'active',
  'archive_pending',
  'archived',
] as const
export type ProjectStatus = (typeof projectStatuses)[number]

export const projectCompanyStatuses = ['active', 'exit_pending', 'exited'] as const
export type ProjectCompanyStatus = (typeof projectCompanyStatuses)[number]

export const companyProjectRoles = ['manager', 'member'] as const
export type CompanyProjectRole = (typeof companyProjectRoles)[number]

export const projectMemberStatuses = [
  'active',
  'suspended',
  'removed',
  'archived',
] as const
export type ProjectMemberStatus = (typeof projectMemberStatuses)[number]

export const channelStatuses = ['active', 'archive_pending', 'archived'] as const
export type ChannelStatus = (typeof channelStatuses)[number]

export const channelParticipationRequestStatuses = [
  'pending',
  'accepted',
  'declined',
  'revoked',
] as const
export type ChannelParticipationRequestStatus =
  (typeof channelParticipationRequestStatuses)[number]

export const archiveRetentionStatuses = ['active', 'revoked'] as const
export type ArchiveRetentionStatus = (typeof archiveRetentionStatuses)[number]

export const companyHandlePattern = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/

const reservedCompanyHandles = new Set([
  'admin',
  'api',
  'help',
  'root',
  'security',
  'support',
  'track',
  'www',
])

export function normalizeCompanyHandle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function isCompanyHandleAllowed(value: string) {
  const handle = normalizeCompanyHandle(value)
  return companyHandlePattern.test(handle) && !reservedCompanyHandles.has(handle)
}

export function canAdministerCompany(role: CompanyRole) {
  return role === 'owner' || role === 'admin'
}

export function canManageProject(role: CompanyProjectRole) {
  return role === 'manager'
}

export function resolveRelationshipStatus(activeCompanyCount: number) {
  if (activeCompanyCount < 1) return 'closed' as const
  if (activeCompanyCount === 1) return 'inactive' as const
  return 'active' as const
}

export function hasUnanimousApproval(
  eligibleIds: readonly string[],
  approvals: ReadonlyMap<string, ApprovalDecision>,
) {
  return eligibleIds.length > 0 && eligibleIds.every((id) => approvals.get(id) === 'approved')
}

export function canTransitionCompany(from: CompanyStatus, to: CompanyStatus) {
  return (
    (from === 'active' && (to === 'suspended' || to === 'closed')) ||
    (from === 'suspended' && (to === 'active' || to === 'closed'))
  )
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus) {
  return (
    (from === 'proposed' && to === 'active') ||
    (from === 'active' && (to === 'archive_pending' || to === 'archived')) ||
    (from === 'archive_pending' && (to === 'active' || to === 'archived')) ||
    (from === 'archived' && to === 'active')
  )
}

export function canTransitionProjectCompany(
  from: ProjectCompanyStatus,
  to: ProjectCompanyStatus,
) {
  return (
    (from === 'active' && to === 'exit_pending') ||
    (from === 'exit_pending' && (to === 'active' || to === 'exited'))
  )
}
