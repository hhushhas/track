import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  channelThreadFollowPreference,
  channelThreadFollowReason,
  channelThreadStatus,
} from './foundationValidators'

export const threadTables = {
  channelThreads: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    name: v.string(),
    sourceMessageId: v.optional(v.id('messages')),
    sourceAvailable: v.boolean(),
    createdBy: v.id('users'),
    createdByProjectMemberId: v.id('projectMembers'),
    actingCompanyId: v.optional(v.id('companies')),
    status: channelThreadStatus,
    revision: v.number(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index('by_group_status_updated_at', ['groupId', 'status', 'updatedAt'])
    .index('by_source_message', ['sourceMessageId'])
    .index('by_creator', ['createdByProjectMemberId'])
    .index('by_group_idempotency', ['groupId', 'idempotencyKey'])
    .searchIndex('search_name_by_project', {
      searchField: 'name',
      filterFields: ['projectId', 'groupId', 'status'],
    }),

  channelThreadFollowers: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    channelThreadId: v.id('channelThreads'),
    userId: v.id('users'),
    projectMemberId: v.id('projectMembers'),
    reason: channelThreadFollowReason,
    preference: channelThreadFollowPreference,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread_member', ['channelThreadId', 'projectMemberId'])
    .index('by_member_preference', ['projectMemberId', 'preference'])
    .index('by_group_member_preference', ['groupId', 'projectMemberId', 'preference']),

  channelThreadReadStates: defineTable({
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    channelThreadId: v.id('channelThreads'),
    userId: v.id('users'),
    projectMemberId: v.id('projectMembers'),
    lastReadChannelSequence: v.number(),
    lastReadAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread_member', ['channelThreadId', 'projectMemberId'])
    .index('by_member_group', ['projectMemberId', 'groupId'])
    .index('by_thread_sequence', ['channelThreadId', 'lastReadChannelSequence']),
} as const
