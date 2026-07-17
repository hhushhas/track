import { describe, expect, it } from 'vitest'

import { getActiveChannelMembers } from './channel-header-members'

const channelA = 'channel-a' as never
const channelB = 'channel-b' as never

function member({
  groupId,
  name,
  status = 'active',
  user = true,
}: {
  groupId: typeof channelA
  name: string
  status?: 'active' | 'removed' | 'suspended' | 'archived'
  user?: boolean
}) {
  return {
    membership: { groupId, status },
    user: user ? { _id: name, displayName: name } : null,
  } as never
}

describe('getActiveChannelMembers', () => {
  it('excludes Project members who are not in the active Channel', () => {
    const members = [
      member({ groupId: channelA, name: 'Amina' }),
      member({ groupId: channelB, name: 'Project-only member' }),
    ]

    expect(getActiveChannelMembers(channelA, members).map((item) => item.user.displayName)).toEqual(['Amina'])
  })

  it('includes active Channel members and excludes inactive or missing-user memberships', () => {
    const members = [
      member({ groupId: channelA, name: 'Active member' }),
      member({ groupId: channelA, name: 'Removed member', status: 'removed' }),
      member({ groupId: channelA, name: 'Suspended member', status: 'suspended' }),
      member({ groupId: channelA, name: 'Archived member', status: 'archived' }),
      member({ groupId: channelA, name: 'Missing user', user: false }),
    ]

    expect(getActiveChannelMembers(channelA, members).map((item) => item.user.displayName)).toEqual(['Active member'])
  })

  it('clears a previous Channel response until the newly selected Channel response arrives', () => {
    const previousChannelResponse = [member({ groupId: channelA, name: 'Amina' })]
    const nextChannelResponse = [member({ groupId: channelB, name: 'Bilal' })]

    expect(getActiveChannelMembers(channelB, previousChannelResponse)).toEqual([])
    expect(getActiveChannelMembers(channelB, nextChannelResponse).map((item) => item.user.displayName)).toEqual(['Bilal'])
    expect(getActiveChannelMembers(null, nextChannelResponse)).toEqual([])
  })
})
