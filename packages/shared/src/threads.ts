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

export const channelThreadNameMaxLength = 100

export function normalizeChannelThreadName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function validateChannelThreadName(value: string) {
  const name = normalizeChannelThreadName(value)
  if (!name) throw new Error('thread_name_required')
  if (name.length > channelThreadNameMaxLength) {
    throw new Error('thread_name_too_long')
  }
  return name
}
