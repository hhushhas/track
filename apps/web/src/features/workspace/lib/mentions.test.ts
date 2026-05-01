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
    membership: { role: 'staff' },
    user: { _id: 'user-1', displayName: 'Hasan Shoaib', email: 'hasan@example.com' },
  },
  {
    membership: { role: 'client' },
    user: { _id: 'user-2', displayName: 'Client Lead', email: 'client@example.com' },
  },
] as Parameters<typeof buildWorkspaceMentionOptions>[0]

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

  it('builds the composer placeholder from visible people or the active group', () => {
    expect(buildComposerPlaceholder({ activeProjectMembers: members, activeGroupName: 'General' })).toBe(
      'Write to the project - Hasan, Client',
    )
    expect(buildComposerPlaceholder({ activeProjectMembers: [], activeGroupName: 'General' })).toBe(
      'Message General or ask @track...',
    )
  })
})
