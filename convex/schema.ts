import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const projectRole = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('staff'),
  v.literal('client'),
)

const groupKind = v.union(
  v.literal('general'),
  v.literal('internal'),
  v.literal('commercials'),
  v.literal('custom'),
)

const notificationMode = v.union(
  v.literal('all'),
  v.literal('mentions'),
  v.literal('none'),
)

const groupNotificationMode = v.union(
  v.literal('inherit'),
  v.literal('all'),
  v.literal('mentions'),
  v.literal('none'),
)

const contentReportTargetType = v.union(
  v.literal('message'),
  v.literal('attachment'),
  v.literal('voice_note'),
  v.literal('assistant_answer'),
)

const contentReportReason = v.union(
  v.literal('inaccurate'),
  v.literal('unsafe'),
  v.literal('spam'),
  v.literal('harassment'),
  v.literal('privacy'),
  v.literal('other'),
)

const recordType = v.union(
  v.literal('task'),
  v.literal('scope_change'),
  v.literal('decision'),
  v.literal('action_item'),
  v.literal('blocker'),
  v.literal('question'),
)

const recordClassification = v.union(
  v.literal('official_record'),
  v.literal('billable_scope'),
  v.literal('non_billable_scope'),
  v.literal('informational'),
  v.literal('ignored'),
)

const recordStatus = v.union(
  v.literal('proposed'),
  v.literal('accepted'),
  v.literal('declined'),
  v.literal('open'),
  v.literal('in_progress'),
  v.literal('blocked'),
  v.literal('done'),
)

const jobStatus = v.union(
  v.literal('queued'),
  v.literal('running'),
  v.literal('completed'),
  v.literal('failed'),
)

const attachmentKind = v.union(v.literal('file'), v.literal('voice_note'))

const evidenceItem = v.object({
  messageId: v.optional(v.id('messages')),
  attachmentId: v.optional(v.id('attachments')),
  quote: v.string(),
  reason: v.optional(v.string()),
})

const forwardedAttachmentSnapshot = v.object({
  filename: v.string(),
  contentType: v.string(),
  size: v.number(),
  kind: v.optional(attachmentKind),
  durationMs: v.optional(v.number()),
})

const forwardedMessageSnapshot = v.object({
  sourceProjectId: v.id('projects'),
  sourceGroupId: v.id('groups'),
  sourceMessageId: v.id('messages'),
  originalAuthorId: v.id('users'),
  originalAuthorName: v.string(),
  originalBody: v.string(),
  originalCreatedAt: v.number(),
  attachmentSnapshots: v.array(forwardedAttachmentSnapshot),
  forwardedAt: v.number(),
})

export default defineSchema({
  users: defineTable({
    googleSubject: v.string(),
    authUserId: v.optional(v.string()),
    normalizedEmail: v.optional(v.string()),
    email: v.string(),
    displayName: v.string(),
    profileDesignation: v.optional(v.string()),
    profileBio: v.optional(v.string()),
    profileBannerStyle: v.optional(v.string()),
    timezone: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
    profileCompletedAt: v.optional(v.number()),
    twoFactorEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_google_subject', ['googleSubject'])
    .index('by_auth_user_id', ['authUserId'])
    .index('by_normalized_email', ['normalizedEmail']),

  projects: defineTable({
    name: v.string(),
    clientLabel: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_created_by', ['createdBy']),

  projectMembers: defineTable({
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: projectRole,
    canReviewAiRecords: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_user', ['userId'])
    .index('by_project_user', ['projectId', 'userId']),

  groups: defineTable({
    projectId: v.id('projects'),
    kind: groupKind,
    name: v.string(),
    aiReviewSettings: v.optional(
      v.object({
        enabled: v.boolean(),
        frequencyMinutes: v.number(),
      }),
    ),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .searchIndex('search_name_by_project', {
      searchField: 'name',
      filterFields: ['projectId'],
    }),

  groupMembers: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_user', ['userId'])
    .index('by_group_user', ['groupId', 'userId']),

  invitations: defineTable({
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    email: v.string(),
    role: projectRole,
    canReviewAiRecords: v.boolean(),
    invitedBy: v.id('users'),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('revoked'),
      v.literal('expired'),
    ),
    token: v.string(),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.id('users')),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_email_status', ['email', 'status'])
    .index('by_token', ['token']),

  messages: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    authorId: v.id('users'),
    body: v.string(),
    mentions: v.array(v.id('users')),
    attachmentIds: v.array(v.id('attachments')),
    replyToMessageId: v.optional(v.id('messages')),
    forwardedFrom: v.optional(forwardedMessageSnapshot),
    notificationPreview: v.optional(v.string()),
    trackInvocationId: v.optional(v.id('assistantStreams')),
    createdAt: v.number(),
  })
    .index('by_group_created_at', ['groupId', 'createdAt'])
    .index('by_project_created_at', ['projectId', 'createdAt'])
    .searchIndex('search_body_by_project', {
      searchField: 'body',
      filterFields: ['projectId'],
    }),

  groupReadStates: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    lastReadMessageId: v.optional(v.id('messages')),
    lastReadAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_group', ['userId', 'groupId'])
    .index('by_user_project', ['userId', 'projectId'])
    .index('by_group', ['groupId']),

  lastActiveContexts: defineTable({
    userId: v.id('users'),
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    deviceId: v.optional(v.string()),
    platform: v.optional(v.union(v.literal('web'), v.literal('ios'), v.literal('android'))),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_device', ['userId', 'deviceId']),

  typingIndicators: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    activity: v.optional(
      v.union(v.literal('typing'), v.literal('attaching'), v.literal('recording')),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_group_updated_at', ['groupId', 'updatedAt'])
    .index('by_group_user', ['groupId', 'userId'])
    .index('by_user', ['userId']),

  attachments: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    messageId: v.id('messages'),
    storageId: v.id('_storage'),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    kind: v.optional(attachmentKind),
    durationMs: v.optional(v.number()),
    uploadedBy: v.id('users'),
    extractionStatus: v.union(
      v.literal('preserved'),
      v.literal('pending'),
      v.literal('extracted'),
      v.literal('failed'),
    ),
    createdAt: v.number(),
  })
    .index('by_message', ['messageId'])
    .index('by_group', ['groupId'])
    .searchIndex('search_filename_by_project', {
      searchField: 'filename',
      filterFields: ['projectId'],
    }),

  notificationSettings: defineTable({
    userId: v.id('users'),
    globalMode: notificationMode,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  groupNotificationSettings: defineTable({
    userId: v.id('users'),
    groupId: v.id('groups'),
    mode: groupNotificationMode,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_group', ['userId', 'groupId']),

  auditEvents: defineTable({
    projectId: v.optional(v.id('projects')),
    groupId: v.optional(v.id('groups')),
    actorId: v.optional(v.id('users')),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    correlationId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_project_created_at', ['projectId', 'createdAt'])
    .index('by_group_created_at', ['groupId', 'createdAt'])
    .index('by_entity', ['entityType', 'entityId']),

  aiReviews: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    trigger: v.union(v.literal('manual'), v.literal('scheduled')),
    status: jobStatus,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    lastReviewedMessageId: v.optional(v.id('messages')),
    lastReviewedAt: v.optional(v.number()),
    model: v.string(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index('by_group_started_at', ['groupId', 'startedAt'])
    .index('by_project_started_at', ['projectId', 'startedAt']),

  draftRecords: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    aiReviewId: v.optional(v.id('aiReviews')),
    sourceMessageIds: v.array(v.id('messages')),
    type: recordType,
    title: v.string(),
    description: v.string(),
    proposedStatus: recordStatus,
    proposedOwnerId: v.optional(v.id('users')),
    evidence: v.array(evidenceItem),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_group_status', ['groupId', 'status'])
    .index('by_project_status', ['projectId', 'status']),

  records: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    draftRecordId: v.optional(v.id('draftRecords')),
    sourceMessageIds: v.array(v.id('messages')),
    type: recordType,
    classification: recordClassification,
    status: recordStatus,
    title: v.string(),
    description: v.string(),
    searchText: v.optional(v.string()),
    ownerId: v.optional(v.id('users')),
    requestedById: v.optional(v.id('users')),
    reviewedBy: v.id('users'),
    reviewedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_group', ['groupId'])
    .index('by_project_classification', ['projectId', 'classification'])
    .index('by_project_status', ['projectId', 'status'])
    .searchIndex('search_text_by_project', {
      searchField: 'searchText',
      filterFields: ['projectId'],
    }),

  exports: defineTable({
    projectId: v.id('projects'),
    requestedBy: v.id('users'),
    format: v.union(v.literal('csv'), v.literal('pdf')),
    preset: v.union(v.literal('client_summary'), v.literal('full_audit_packet')),
    filters: v.any(),
    status: jobStatus,
    storageId: v.optional(v.id('_storage')),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_project_created_at', ['projectId', 'createdAt'])
    .index('by_requested_by_created_at', ['requestedBy', 'createdAt']),

  notificationSubscriptions: defineTable({
    userId: v.id('users'),
    platform: v.union(v.literal('web'), v.literal('ios'), v.literal('android')),
    tokenOrEndpoint: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  contentReports: defineTable({
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    reporterId: v.id('users'),
    targetType: contentReportTargetType,
    targetMessageId: v.optional(v.id('messages')),
    targetAttachmentId: v.optional(v.id('attachments')),
    targetAssistantStreamId: v.optional(v.id('assistantStreams')),
    reason: contentReportReason,
    note: v.optional(v.string()),
    status: v.union(
      v.literal('open'),
      v.literal('reviewed'),
      v.literal('dismissed'),
      v.literal('actioned'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_reporter_created_at', ['reporterId', 'createdAt']),

  accountDeletionRequests: defineTable({
    userId: v.id('users'),
    authUserId: v.optional(v.string()),
    status: v.union(v.literal('requested'), v.literal('completed')),
    requestedAt: v.number(),
    completedAt: v.optional(v.number()),
    retentionNote: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  assistantStreams: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    requesterId: v.id('users'),
    promptMessageId: v.optional(v.id('messages')),
    status: jobStatus,
    answer: v.string(),
    evidence: v.array(evidenceItem),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_group_created_at', ['groupId', 'createdAt']),

  securityStepUps: defineTable({
    userId: v.id('users'),
    authUserId: v.string(),
    action: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_action', ['userId', 'action'])
    .index('by_auth_user_action', ['authUserId', 'action']),
})
