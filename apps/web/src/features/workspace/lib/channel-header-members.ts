import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'

export type ChannelMemberItem = {
  membership: Doc<'groupMembers'>
  user: Doc<'users'> | null
}

export type ActiveChannelMemberItem = ChannelMemberItem & {
  user: Doc<'users'>
}

export function getActiveChannelMembers(
  activeGroupId: Id<'groups'> | null,
  members: Array<ChannelMemberItem>,
): Array<ActiveChannelMemberItem> {
  if (!activeGroupId) return []

  return members.filter((item): item is ActiveChannelMemberItem =>
    item.membership.groupId === activeGroupId &&
    item.membership.status === 'active' &&
    item.user !== null,
  )
}
