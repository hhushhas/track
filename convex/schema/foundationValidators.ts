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
import {
  taskFollowerReasons,
  taskJobStatuses,
  taskNotificationModes,
  taskPriorities,
  taskReferenceAvailability,
  taskReferenceTypes,
  taskReminderKinds,
  taskScopeKinds,
  taskStateCategories,
  taskSuggestionDismissalReasons,
  taskSuggestionStatuses,
} from '@track/shared/tasks'
import {
  channelThreadFollowPreferences,
  channelThreadFollowReasons,
  channelThreadStatuses,
} from '@track/shared/threads'

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

export const channelThreadStatus = literalUnion(channelThreadStatuses)
export const channelThreadFollowReason = literalUnion(channelThreadFollowReasons)
export const channelThreadFollowPreference = literalUnion(channelThreadFollowPreferences)

export const taskScopeKind = literalUnion(taskScopeKinds)
export const taskStateCategory = literalUnion(taskStateCategories)
export const taskPriority = literalUnion(taskPriorities)
export const taskReferenceType = literalUnion(taskReferenceTypes)
export const taskReferenceAvailabilityStatus = literalUnion(taskReferenceAvailability)
export const taskSuggestionStatus = literalUnion(taskSuggestionStatuses)
export const taskSuggestionDismissalReason = literalUnion(taskSuggestionDismissalReasons)
export const taskFollowerReason = literalUnion(taskFollowerReasons)
export const taskNotificationMode = literalUnion(taskNotificationModes)
export const taskReminderKind = literalUnion(taskReminderKinds)
export const taskJobStatus = literalUnion(taskJobStatuses)

export const archiveState = v.union(v.literal('active'), v.literal('archived'))
