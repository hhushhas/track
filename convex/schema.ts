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

export default defineSchema({
  users: defineTable({
    googleSubject: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    twoFactorEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_google_subject', ['googleSubject']),

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
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_project', ['projectId']),

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

  messages: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    authorId: v.id('users'),
    body: v.string(),
    mentions: v.array(v.id('users')),
    attachmentIds: v.array(v.id('attachments')),
    createdAt: v.number(),
  })
    .index('by_group_created_at', ['groupId', 'createdAt'])
    .index('by_project_created_at', ['projectId', 'createdAt']),

  attachments: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    messageId: v.id('messages'),
    storageId: v.id('_storage'),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadedBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_message', ['messageId'])
    .index('by_group', ['groupId']),

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
    createdAt: v.number(),
  })
    .index('by_project_created_at', ['projectId', 'createdAt'])
    .index('by_group_created_at', ['groupId', 'createdAt']),
})
