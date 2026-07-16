import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  approvalDecision,
  approvalRequestStatus,
  archiveRetentionStatus,
  channelParticipationRequestStatus,
  companyMemberStatus,
  companyRole,
  companyStatus,
  invitationStatus,
  projectCompanyStatus,
  relationshipCompanyStatus,
  relationshipStatus,
} from './foundationValidators'

export const companyTables = {
  companies: defineTable({
    displayName: v.string(),
    normalizedHandle: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
    status: companyStatus,
    revision: v.number(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index('by_handle', ['normalizedHandle'])
    .index('by_status_updated_at', ['status', 'updatedAt']),

  companyMembers: defineTable({
    companyId: v.id('companies'),
    userId: v.id('users'),
    role: companyRole,
    status: companyMemberStatus,
    invitedBy: v.optional(v.id('users')),
    userDisplayNameSnapshot: v.string(),
    companyDisplayNameSnapshot: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index('by_company', ['companyId'])
    .index('by_user_status', ['userId', 'status'])
    .index('by_company_user', ['companyId', 'userId'])
    .index('by_company_status_role', ['companyId', 'status', 'role']),

  companyInvitations: defineTable({
    companyId: v.id('companies'),
    normalizedEmail: v.string(),
    recipientUserId: v.optional(v.id('users')),
    role: companyRole,
    tokenHash: v.string(),
    status: invitationStatus,
    invitedBy: v.id('users'),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.id('users')),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_company_status', ['companyId', 'status'])
    .index('by_email_status', ['normalizedEmail', 'status'])
    .index('by_recipient_status', ['recipientUserId', 'status'])
    .index('by_token_hash', ['tokenHash']),

  relationships: defineTable({
    name: v.string(),
    status: relationshipStatus,
    createdBy: v.id('users'),
    createdByCompanyId: v.id('companies'),
    participantRevision: v.number(),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index('by_status_updated_at', ['status', 'updatedAt'])
    .index('by_creating_company', ['createdByCompanyId']),

  relationshipCompanies: defineTable({
    relationshipId: v.id('relationships'),
    companyId: v.id('companies'),
    term: v.number(),
    status: relationshipCompanyStatus,
    acceptedBy: v.id('users'),
    acceptedAt: v.number(),
    endedBy: v.optional(v.id('users')),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_relationship_status', ['relationshipId', 'status'])
    .index('by_company_status', ['companyId', 'status'])
    .index('by_relationship_company_term', ['relationshipId', 'companyId', 'term']),

  relationshipInvitations: defineTable({
    relationshipId: v.id('relationships'),
    targetCompanyId: v.id('companies'),
    invitingCompanyId: v.id('companies'),
    invitedBy: v.id('users'),
    tokenHash: v.string(),
    status: invitationStatus,
    expiresAt: v.number(),
    decidedBy: v.optional(v.id('users')),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_relationship_status', ['relationshipId', 'status'])
    .index('by_target_status', ['targetCompanyId', 'status'])
    .index('by_token_hash', ['tokenHash']),

  relationshipRemovalRequests: defineTable({
    relationshipId: v.id('relationships'),
    targetCompanyId: v.id('companies'),
    participantRevision: v.number(),
    proposedByCompanyId: v.id('companies'),
    proposedBy: v.id('users'),
    status: approvalRequestStatus,
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index('by_relationship_status', ['relationshipId', 'status'])
    .index('by_target_status', ['targetCompanyId', 'status'])
    .index('by_relationship_idempotency', ['relationshipId', 'idempotencyKey']),

  relationshipRemovalApprovals: defineTable({
    requestId: v.id('relationshipRemovalRequests'),
    companyId: v.id('companies'),
    decidedBy: v.id('users'),
    decision: approvalDecision,
    participantRevision: v.number(),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
    .index('by_request_company', ['requestId', 'companyId']),

  projectCompanyInvitations: defineTable({
    projectId: v.id('projects'),
    targetCompanyId: v.id('companies'),
    invitingCompanyId: v.id('companies'),
    invitedBy: v.id('users'),
    tokenHash: v.string(),
    status: invitationStatus,
    expiresAt: v.number(),
    decidedBy: v.optional(v.id('users')),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_target_status', ['targetCompanyId', 'status'])
    .index('by_token_hash', ['tokenHash']),

  projectCompanies: defineTable({
    projectId: v.id('projects'),
    companyId: v.id('companies'),
    term: v.number(),
    status: projectCompanyStatus,
    acceptedBy: v.id('users'),
    acceptedAt: v.number(),
    exitPreparedBy: v.optional(v.id('users')),
    exitPreparedAt: v.optional(v.number()),
    exitCutoffSequence: v.optional(v.number()),
    exitedBy: v.optional(v.id('users')),
    exitedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_company_status', ['companyId', 'status'])
    .index('by_project_company_term', ['projectId', 'companyId', 'term']),

  projectArchiveRequests: defineTable({
    projectId: v.id('projects'),
    participantRevision: v.number(),
    requestedByCompanyId: v.id('companies'),
    requestedBy: v.id('users'),
    operation: v.union(v.literal('archive'), v.literal('restore')),
    status: approvalRequestStatus,
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_project_idempotency', ['projectId', 'idempotencyKey']),

  projectArchiveApprovals: defineTable({
    requestId: v.id('projectArchiveRequests'),
    projectCompanyId: v.id('projectCompanies'),
    decidedBy: v.id('users'),
    decision: approvalDecision,
    participantRevision: v.number(),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
    .index('by_request_participant', ['requestId', 'projectCompanyId']),

  projectArchiveEntitlements: defineTable({
    projectId: v.id('projects'),
    projectCompanyId: v.id('projectCompanies'),
    companyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    exitAt: v.number(),
    channelIds: v.array(v.id('groups')),
    projectNameSnapshot: v.string(),
    companyNameSnapshot: v.string(),
    retentionStatus: archiveRetentionStatus,
    manifestHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_company', ['projectId', 'companyId'])
    .index('by_member', ['projectMemberId'])
    .index('by_retention_status', ['retentionStatus']),

  projectArchiveSnapshots: defineTable({
    entitlementId: v.id('projectArchiveEntitlements'),
    scope: v.union(v.literal('project'), v.literal('channel')),
    groupId: v.optional(v.id('groups')),
    sourceKind: v.string(),
    sourceIdentifier: v.string(),
    sourceRevision: v.optional(v.number()),
    contentHash: v.string(),
    snapshotStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
  })
    .index('by_entitlement', ['entitlementId'])
    .index('by_entitlement_scope', ['entitlementId', 'scope', 'groupId']),

  channelParticipationRequests: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    targetProjectCompanyId: v.id('projectCompanies'),
    invitedByProjectMemberId: v.id('projectMembers'),
    selectedProjectMemberIds: v.array(v.id('projectMembers')),
    status: channelParticipationRequestStatus,
    decidedByProjectMemberId: v.optional(v.id('projectMembers')),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index('by_group_status', ['groupId', 'status'])
    .index('by_target_status', ['targetProjectCompanyId', 'status'])
    .index('by_group_idempotency', ['groupId', 'idempotencyKey']),
} as const
