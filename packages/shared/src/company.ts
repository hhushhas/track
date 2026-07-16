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

export const approvalRequestStatuses = ['pending', 'approved', 'canceled'] as const
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
