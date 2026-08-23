import { describe, expect, it } from 'vitest'

import {
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
] as Parameters<typeof buildMentionGroups>[0]

const groups = [
  { _id: 'group-1', name: 'General' },
  { _id: 'group-2', name: 'Client Lead' },
] as Parameters<typeof buildWorkspaceMentionOptions>[1]

describe('workspace mentions', () => {
  it('applies mention handle collisions and selection grouping', () => {
    const options = buildWorkspaceMentionOptions(members, groups)

    expect(options.map((option) => [option.kind, option.handle])).toEqual([
      ['assistant', 'track'],
      ['group', 'general'],
      ['member', 'hasan-shoaib'],
      ['member', 'client-lead'],
    ])
    expect(Array.from(buildMentionGroups(members, groups).keys())).toEqual(['general'])

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
})
