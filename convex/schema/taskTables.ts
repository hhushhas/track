import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  archiveState,
  taskFollowerReason,
  taskJobStatus,
  taskNotificationMode,
  taskPriority,
  taskReferenceAvailabilityStatus,
  taskReferenceType,
  taskReminderKind,
  taskScopeKind,
  taskStateCategory,
  taskSuggestionDismissalReason,
  taskSuggestionStatus,
} from './foundationValidators'

const proposedTaskFields = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  assigneeProjectMemberId: v.optional(v.id('projectMembers')),
  priority: taskPriority,
  dueDate: v.optional(v.string()),
})

export const taskTables = {
  taskBoards: defineTable({
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    scopeKind: taskScopeKind,
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.boolean(),
    archiveState,
    createdByProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index('by_project_archive', ['projectId', 'archiveState'])
    .index('by_scope_archive', ['projectId', 'groupId', 'archiveState'])
    .index('by_scope_default', ['projectId', 'groupId', 'isDefault']),

  taskWorkflowStates: defineTable({
    projectId: v.id('projects'),
    boardId: v.id('taskBoards'),
    name: v.string(),
    category: taskStateCategory,
    visualToken: v.string(),
    rank: v.string(),
    isDefault: v.boolean(),
    archiveState,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_board_rank', ['boardId', 'rank'])
    .index('by_board_archive', ['boardId', 'archiveState'])
    .index('by_board_default', ['boardId', 'isDefault']),

  tasks: defineTable({
    publicKey: v.string(),
    projectId: v.id('projects'),
    boardId: v.id('taskBoards'),
    groupId: v.optional(v.id('groups')),
    scopeKind: taskScopeKind,
    parentTaskId: v.optional(v.id('tasks')),
    workflowStateId: v.id('taskWorkflowStates'),
    rank: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeProjectMemberId: v.optional(v.id('projectMembers')),
    priority: taskPriority,
    dueDate: v.optional(v.string()),
    createdByProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    sourceSuggestionId: v.optional(v.id('taskSuggestions')),
    revision: v.number(),
    archiveState,
    terminalAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index('by_project_key', ['projectId', 'publicKey'])
    .index('by_board_state_rank', ['boardId', 'workflowStateId', 'rank'])
    .index('by_scope_archive', ['projectId', 'groupId', 'archiveState'])
    .index('by_assignee_archive', ['assigneeProjectMemberId', 'archiveState'])
    .index('by_parent_rank', ['parentTaskId', 'rank'])
    .searchIndex('search_title_by_project', {
      searchField: 'title',
      filterFields: ['projectId', 'groupId', 'archiveState'],
    }),

  taskLabels: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    normalizedName: v.string(),
    visualToken: v.string(),
    archiveState,
    createdByProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_archive', ['projectId', 'archiveState'])
    .index('by_project_normalized_name', ['projectId', 'normalizedName']),

  taskLabelLinks: defineTable({
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    labelId: v.id('taskLabels'),
    createdByProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    createdAt: v.number(),
  })
    .index('by_task', ['taskId'])
    .index('by_label_task', ['labelId', 'taskId'])
    .index('by_task_label', ['taskId', 'labelId']),

  taskReferences: defineTable({
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    sourceType: taskReferenceType,
    sourceProjectId: v.id('projects'),
    sourceGroupId: v.optional(v.id('groups')),
    sourceMessageId: v.optional(v.id('messages')),
    sourceAttachmentId: v.optional(v.id('attachments')),
    sourceAssistantStreamId: v.optional(v.id('assistantStreams')),
    sourceMemoryImportId: v.optional(v.id('memoryImports')),
    quoteSnapshot: v.string(),
    availability: taskReferenceAvailabilityStatus,
    isPrimary: v.boolean(),
    actorProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    rank: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_task_rank', ['taskId', 'rank'])
    .index('by_task_primary', ['taskId', 'isPrimary'])
    .index('by_source_message', ['sourceMessageId'])
    .index('by_source_attachment', ['sourceAttachmentId']),

  taskComments: defineTable({
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    originalGroupId: v.optional(v.id('groups')),
    authorProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    body: v.string(),
    mentionedProjectMemberIds: v.array(v.id('projectMembers')),
    revision: v.number(),
    archiveState,
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index('by_task_created_at', ['taskId', 'createdAt'])
    .index('by_task_idempotency', ['taskId', 'idempotencyKey'])
    .index('by_author_created_at', ['authorProjectMemberId', 'createdAt']),

  taskFollowers: defineTable({
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    userId: v.id('users'),
    projectMemberId: v.id('projectMembers'),
    reason: taskFollowerReason,
    isFollowing: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_task_member', ['taskId', 'projectMemberId'])
    .index('by_member_following', ['projectMemberId', 'isFollowing'])
    .index('by_task_following', ['taskId', 'isFollowing']),

  taskActivities: defineTable({
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    originalGroupId: v.optional(v.id('groups')),
    actorProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    action: v.string(),
    beforeSummary: v.optional(v.string()),
    afterSummary: v.optional(v.string()),
    correlationId: v.string(),
    createdAt: v.number(),
  })
    .index('by_task_created_at', ['taskId', 'createdAt'])
    .index('by_project_created_at', ['projectId', 'createdAt'])
    .index('by_correlation', ['correlationId']),

  taskSuggestions: defineTable({
    projectId: v.id('projects'),
    scopeKind: taskScopeKind,
    sourceGroupId: v.optional(v.id('groups')),
    proposed: proposedTaskFields,
    status: taskSuggestionStatus,
    confidence: v.number(),
    groundingReason: v.string(),
    fingerprint: v.string(),
    possibleDuplicateTaskId: v.optional(v.id('tasks')),
    decisionReason: v.optional(taskSuggestionDismissalReason),
    decidedByProjectMemberId: v.optional(v.id('projectMembers')),
    decidedByActingCompanyId: v.optional(v.id('companies')),
    acceptedTaskId: v.optional(v.id('tasks')),
    linkedTaskId: v.optional(v.id('tasks')),
    duplicateOverride: v.boolean(),
    archiveState,
    modelVersion: v.string(),
    promptVersion: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index('by_scope_status', ['projectId', 'sourceGroupId', 'status'])
    .index('by_project_fingerprint', ['projectId', 'fingerprint'])
    .index('by_duplicate', ['possibleDuplicateTaskId'])
    .index('by_created_at', ['createdAt']),

  taskSuggestionReferences: defineTable({
    projectId: v.id('projects'),
    suggestionId: v.id('taskSuggestions'),
    sourceType: taskReferenceType,
    sourceGroupId: v.optional(v.id('groups')),
    sourceMessageId: v.optional(v.id('messages')),
    sourceAttachmentId: v.optional(v.id('attachments')),
    sourceAssistantStreamId: v.optional(v.id('assistantStreams')),
    sourceMemoryImportId: v.optional(v.id('memoryImports')),
    quoteSnapshot: v.string(),
    availability: taskReferenceAvailabilityStatus,
    isPrimary: v.boolean(),
    rank: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_suggestion_rank', ['suggestionId', 'rank'])
    .index('by_source_message', ['sourceMessageId']),

  taskSuggestionHides: defineTable({
    suggestionId: v.id('taskSuggestions'),
    projectMemberId: v.id('projectMembers'),
    hiddenAt: v.number(),
  })
    .index('by_member', ['projectMemberId'])
    .index('by_suggestion_member', ['suggestionId', 'projectMemberId']),

  taskDetectionSettings: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    enabled: v.boolean(),
    generation: v.number(),
    highWaterSequence: v.number(),
    configuredByProjectMemberId: v.id('projectMembers'),
    configuredByActingCompanyId: v.optional(v.id('companies')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_project_enabled', ['projectId', 'enabled']),

  taskDetectionRuns: defineTable({
    settingId: v.id('taskDetectionSettings'),
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    generation: v.number(),
    startSequence: v.number(),
    endSequence: v.number(),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    coalescingKey: v.string(),
    status: taskJobStatus,
    lowConfidenceCount: v.number(),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_setting_status', ['settingId', 'status'])
    .index('by_coalescing_key', ['coalescingKey'])
    .index('by_lease', ['status', 'leaseExpiresAt']),

  taskNotificationSettings: defineTable({
    projectMemberId: v.id('projectMembers'),
    mode: taskNotificationMode,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_member', ['projectMemberId']),

  taskNotifications: defineTable({
    projectId: v.id('projects'),
    recipientProjectMemberId: v.id('projectMembers'),
    recipientUserId: v.id('users'),
    taskId: v.id('tasks'),
    originalGroupId: v.optional(v.id('groups')),
    sourceEventId: v.optional(v.id('taskActivities')),
    eventType: v.string(),
    safePayload: v.string(),
    idempotencyKey: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_member_read_created_at', ['recipientProjectMemberId', 'readAt', 'createdAt'])
    .index('by_member_idempotency', ['recipientProjectMemberId', 'idempotencyKey'])
    .index('by_task_created_at', ['taskId', 'createdAt']),

  taskReminderJobs: defineTable({
    taskId: v.id('tasks'),
    recipientProjectMemberId: v.id('projectMembers'),
    recipientUserId: v.id('users'),
    kind: taskReminderKind,
    dueDate: v.string(),
    scheduledFunctionId: v.optional(v.id('_scheduled_functions')),
    status: taskJobStatus,
    idempotencyKey: v.string(),
    scheduledAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status_scheduled_at', ['status', 'scheduledAt'])
    .index('by_task_kind', ['taskId', 'kind'])
    .index('by_idempotency', ['idempotencyKey']),

  taskArchiveSnapshots: defineTable({
    projectId: v.id('projects'),
    projectCompanyId: v.id('projectCompanies'),
    projectArchiveEntitlementId: v.id('projectArchiveEntitlements'),
    projectMemberId: v.id('projectMembers'),
    exitAt: v.number(),
    channelIds: v.array(v.id('groups')),
    manifestHash: v.string(),
    createdAt: v.number(),
  })
    .index('by_entitlement', ['projectArchiveEntitlementId'])
    .index('by_member', ['projectMemberId']),

  taskArchiveSnapshotItems: defineTable({
    snapshotId: v.id('taskArchiveSnapshots'),
    entityType: v.union(
      v.literal('board'),
      v.literal('workflow_state'),
      v.literal('task'),
      v.literal('label'),
      v.literal('label_link'),
      v.literal('comment'),
      v.literal('suggestion'),
      v.literal('reference'),
      v.literal('membership_attribution'),
    ),
    entityId: v.string(),
    groupId: v.optional(v.id('groups')),
    sourceRevision: v.optional(v.number()),
    payload: v.string(),
    contentHash: v.string(),
    rank: v.string(),
    createdAt: v.number(),
  })
    .index('by_snapshot_rank', ['snapshotId', 'rank'])
    .index('by_snapshot_entity', ['snapshotId', 'entityType', 'entityId']),
} as const
