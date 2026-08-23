import { describe, expect, it } from 'vitest'

import { getActiveChannelMembers } from './channel-header-members'

const channelA = 'channel-a' as never
const channelB = 'channel-b' as never

function member({
  groupId,
  name,
}: {
  groupId: typeof channelA
  name: string
}) {
  return {
    membership: { groupId },
    user: { _id: name, displayName: name },
  } as never
}

describe('getActiveChannelMembers', () => {
  it('clears a previous Channel response until the newly selected Channel response arrives', () => {
    const previousChannelResponse = [member({ groupId: channelA, name: 'Amina' })]
    const nextChannelResponse = [member({ groupId: channelB, name: 'Bilal' })]

    expect(getActiveChannelMembers(channelB, previousChannelResponse)).toEqual([])
    expect(getActiveChannelMembers(channelB, nextChannelResponse).map((item) => item.user.displayName)).toEqual(['Bilal'])
    expect(getActiveChannelMembers(null, nextChannelResponse)).toEqual([])
  })
})
