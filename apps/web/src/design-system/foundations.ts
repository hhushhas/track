export const TRACK_UI_VERSION = '2.0' as const

export const TRACK_UI_BREAKPOINTS = {
  mobile: 700,
  navigation: 820,
  contextRail: 1080,
  wide: 1280,
} as const

export const TRACK_UI_LAYOUT = {
  navigationWidth: 236,
  navigationCollapsedWidth: 48,
  contextRailWidth: 300,
  contentMaxWidth: 1180,
} as const

export const TRACK_UI_MESSAGE_ACTION_ORDER = [
  'reply',
  'create-task',
  'forward',
  'more',
] as const

export const TRACK_UI_SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const

export function isTrackSpacing(value: number) {
  return TRACK_UI_SPACING.includes(value as (typeof TRACK_UI_SPACING)[number])
}
