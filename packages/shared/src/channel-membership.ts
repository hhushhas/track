import type { ProjectAccessProfile } from './feature-flags'

export type ChannelMembershipState = {
  endedAt?: number
  status?: 'active' | 'suspended' | 'removed' | 'archived'
}

export function isActiveChannelMembership(
  membership: ChannelMembershipState,
  accessProfile: ProjectAccessProfile,
) {
  if (membership.endedAt !== undefined) return false
  if (accessProfile === 'company') return membership.status === 'active'
  return membership.status === undefined || membership.status === 'active'
}
