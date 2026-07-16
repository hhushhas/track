export const channelThreadStatuses = ['active', 'archived'] as const
export type ChannelThreadStatus = (typeof channelThreadStatuses)[number]

export const channelThreadFollowReasons = [
  'created',
  'replied',
  'mentioned',
  'explicit',
] as const
export type ChannelThreadFollowReason = (typeof channelThreadFollowReasons)[number]

export const channelThreadFollowPreferences = ['following', 'unfollowed'] as const
export type ChannelThreadFollowPreference =
  (typeof channelThreadFollowPreferences)[number]
