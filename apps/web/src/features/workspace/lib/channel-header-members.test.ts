import { describe, expect, it } from 'vitest'

import { getActiveChannelMembers } from './channel-header-members'

const channelA = 'channel-a' as never
const channelB = 'channel-b' as never

function member({
  groupId,
  name,
  status,
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
  it('filters Project members to the active Channel and available users', () => {
    const members = [
      member({ groupId: channelA, name: 'Legacy member' }),
      member({ groupId: channelB, name: 'Project-only member' }),
      member({ groupId: channelA, name: 'Explicit active member', status: 'active' }),
      member({ groupId: channelA, name: 'Missing user', user: false }),
    ]

    expect(getActiveChannelMembers(channelA, members).map((item) => item.user.displayName)).toEqual([
      'Legacy member',
      'Explicit active member',
    ])
  })

  it('clears a previous Channel response until the newly selected Channel response arrives', () => {
    const previousChannelResponse = [member({ groupId: channelA, name: 'Amina' })]
    const nextChannelResponse = [member({ groupId: channelB, name: 'Bilal' })]

    expect(getActiveChannelMembers(channelB, previousChannelResponse)).toEqual([])
    expect(getActiveChannelMembers(channelB, nextChannelResponse).map((item) => item.user.displayName)).toEqual(['Bilal'])
    expect(getActiveChannelMembers(null, nextChannelResponse)).toEqual([])
  })
})
