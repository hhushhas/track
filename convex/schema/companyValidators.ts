import { v } from 'convex/values'
import {
  approvalDecisions,
  approvalRequestStatuses,
  archiveRetentionStatuses,
  channelParticipationRequestStatuses,
  channelStatuses,
  companyMemberStatuses,
  companyProjectRoles,
  companyRoles,
  companyStatuses,
  invitationStatuses,
  projectCompanyStatuses,
  projectMemberStatuses,
  projectOrigins,
  projectStatuses,
  relationshipCompanyStatuses,
  relationshipStatuses,
} from '@track/shared/company'

function literalUnion<const Value extends string>(values: readonly Value[]) {
  return v.union(...values.map((value) => v.literal(value)))
}

export const companyStatus = literalUnion(companyStatuses)
export const companyRole = literalUnion(companyRoles)
export const companyMemberStatus = literalUnion(companyMemberStatuses)
export const invitationStatus = literalUnion(invitationStatuses)
export const relationshipStatus = literalUnion(relationshipStatuses)
export const relationshipCompanyStatus = literalUnion(relationshipCompanyStatuses)
export const approvalRequestStatus = literalUnion(approvalRequestStatuses)
export const approvalDecision = literalUnion(approvalDecisions)
export const projectOrigin = literalUnion(projectOrigins)
export const projectStatus = literalUnion(projectStatuses)
export const projectCompanyStatus = literalUnion(projectCompanyStatuses)
export const companyProjectRole = literalUnion(companyProjectRoles)
export const projectMemberStatus = literalUnion(projectMemberStatuses)
export const channelStatus = literalUnion(channelStatuses)
export const channelParticipationRequestStatus = literalUnion(
  channelParticipationRequestStatuses,
)
export const archiveRetentionStatus = literalUnion(archiveRetentionStatuses)
