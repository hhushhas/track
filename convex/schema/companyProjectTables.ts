import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  approvalDecision,
  approvalRequestStatus,
  archiveRetentionStatus,
  channelParticipationRequestStatus,
  invitationStatus,
  projectCompanyStatus,
} from './companyValidators'

export const companyProjectTables = {
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
    .index('by_inviting_status', ['invitingCompanyId', 'status'])
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
    exitCutoff: v.optional(v.number()),
    exitOperationId: v.optional(v.string()),
    exitContextRevision: v.optional(v.number()),
    exitMemoryBoxId: v.optional(v.string()),
    exitProjectSnapshot: v.optional(v.any()),
    exitChannelSnapshots: v.optional(v.array(v.any())),
    exitMemberSnapshots: v.optional(v.array(v.any())),
    memorySnapshotStatus: v.optional(
      v.union(v.literal('pending'), v.literal('verified'), v.literal('failed')),
    ),
    memorySnapshotManifestHash: v.optional(v.string()),
    memorySnapshotManifest: v.optional(v.any()),
    memorySnapshotPath: v.optional(v.string()),
    memorySnapshotError: v.optional(v.string()),
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
    projectSnapshot: v.any(),
    channelSnapshots: v.array(v.any()),
    threadSnapshots: v.optional(v.array(v.any())),
    memberSnapshots: v.optional(v.array(v.any())),
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
    contentLength: v.number(),
    snapshotIdentifier: v.string(),
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

  channelArchiveRequests: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    channelRevision: v.number(),
    operation: v.union(v.literal('archive'), v.literal('restore')),
    requestedByProjectMemberId: v.id('projectMembers'),
    status: approvalRequestStatus,
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index('by_group_status', ['groupId', 'status'])
    .index('by_group_idempotency', ['groupId', 'idempotencyKey']),

  channelArchiveApprovals: defineTable({
    requestId: v.id('channelArchiveRequests'),
    projectCompanyId: v.id('projectCompanies'),
    projectMemberId: v.id('projectMembers'),
    decision: approvalDecision,
    channelRevision: v.number(),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
    .index('by_request_participant', ['requestId', 'projectCompanyId']),

  legacyProjectUpgrades: defineTable({
    projectId: v.id('projects'),
    relationshipId: v.optional(v.id('relationships')),
    initiatedBy: v.id('users'),
    initiatingCompanyId: v.id('companies'),
    status: v.union(
      v.literal('draft'),
      v.literal('awaiting_confirmation'),
      v.literal('ready'),
      v.literal('activated'),
      v.literal('cancelled'),
    ),
    sourceRevision: v.number(),
    sourceUpdatedAt: v.number(),
    sourceMemberIds: v.array(v.id('projectMembers')),
    sourceGroupIds: v.array(v.id('groups')),
    sourceGroupMembershipIds: v.array(v.id('groupMembers')),
    sourceMemberFingerprint: v.string(),
    sourceGroupFingerprint: v.string(),
    sourceGroupMembershipFingerprint: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_project_idempotency', ['projectId', 'idempotencyKey']),

  legacyProjectUpgradeMappings: defineTable({
    upgradeId: v.id('legacyProjectUpgrades'),
    legacyProjectMemberId: v.id('projectMembers'),
    companyId: v.id('companies'),
    neutralRole: v.union(v.literal('manager'), v.literal('member')),
    confirmedByCompany: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_upgrade', ['upgradeId'])
    .index('by_upgrade_member', ['upgradeId', 'legacyProjectMemberId']),

  legacyProjectUpgradeCompanies: defineTable({
    upgradeId: v.id('legacyProjectUpgrades'),
    companyId: v.id('companies'),
    status: v.union(v.literal('pending'), v.literal('confirmed')),
    confirmedBy: v.optional(v.id('users')),
    confirmedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_upgrade', ['upgradeId'])
    .index('by_upgrade_company', ['upgradeId', 'companyId'])
    .index('by_company_status', ['companyId', 'status']),
} as const
