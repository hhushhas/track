import { describe, expect, it } from 'vitest'

import {
  buildComposerPlaceholder,
  buildMentionGroups,
  buildMentionSections,
  buildWorkspaceMentionOptions,
  filterMentionOptions,
} from './mentions'

const members = [
  {
    membership: { groupId: 'group-1' },
    user: { _id: 'user-1', displayName: 'Hasan Shoaib', email: 'hasan@example.com' },
  },
  {
    membership: { groupId: 'group-1' },
    user: { _id: 'user-2', displayName: 'Client Lead', email: 'client@example.com' },
  },
] as Parameters<typeof buildComposerPlaceholder>[0]['activeChannelMembers']

const groups = [
  { _id: 'group-1', name: 'General' },
  { _id: 'group-2', name: 'Client Lead' },
] as Parameters<typeof buildWorkspaceMentionOptions>[1]

describe('workspace mentions', () => {
  it('builds assistant, group, and member mention options while hiding group handle collisions', () => {
    const options = buildWorkspaceMentionOptions(members, groups)

    expect(options.map((option) => [option.kind, option.handle])).toEqual([
      ['assistant', 'track'],
      ['group', 'general'],
      ['member', 'hasan-shoaib'],
      ['member', 'client-lead'],
    ])
  })

  it('builds the group handle lookup with the same collision rules', () => {
    expect(Array.from(buildMentionGroups(members, groups).keys())).toEqual(['general'])
  })

  it('filters mention options and groups them for display', () => {
    const filtered = filterMentionOptions(buildWorkspaceMentionOptions(members, groups), 'lead')

    expect(filtered.map((option) => [option.kind, option.handle])).toEqual([
      ['member', 'client-lead'],
    ])
    expect(buildMentionSections(filtered)).toEqual([
      {
        label: 'People',
        options: filtered,
      },
    ])
  })

  it('builds empty and single-participant copy from Channel members while excluding the current user', () => {
    expect(buildComposerPlaceholder({
      activeChannelMembers: members.slice(0, 1),
      activeGroupName: 'General',
      currentUserId: 'user-1' as never,
    })).toBe('Message General or ask @track...')
    expect(buildComposerPlaceholder({
      activeChannelMembers: members,
      activeGroupName: 'General',
      currentUserId: 'user-1' as never,
    })).toBe(
      'Write to Client in General or ask @track...',
    )
  })

  it('builds multiple-participant copy only from the supplied Channel member set', () => {
    const additionalMembers = [
      {
        membership: { groupId: 'group-1' },
        user: { _id: 'user-3', displayName: 'Amina Khan', email: 'amina@example.com' },
      },
      {
        membership: { groupId: 'group-1' },
        user: { _id: 'user-4', displayName: 'Bilal Ahmed', email: 'bilal@example.com' },
      },
    ] as typeof members

    expect(buildComposerPlaceholder({
      activeChannelMembers: [...members, ...additionalMembers],
      activeGroupName: 'General',
      currentUserId: 'user-1' as never,
    })).toBe(
      'Write to Client, Amina, and 1 other in General or ask @track...',
    )
  })
})
