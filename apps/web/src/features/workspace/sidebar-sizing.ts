export const SIDEBAR_COLLAPSED_WIDTH = 48
export const SIDEBAR_DEFAULT_WIDTH = 236
export const SIDEBAR_MIN_WIDTH = 208
export const SIDEBAR_MAX_WIDTH = 320
export const SIDEBAR_COLLAPSE_THRESHOLD = 152

export function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))
}

export function getStoredSidebarWidth(value: string | null) {
  if (value === null || value.trim() === '') return SIDEBAR_DEFAULT_WIDTH
  const parsedWidth = Number(value)
  return Number.isFinite(parsedWidth)
    ? clampSidebarWidth(parsedWidth)
    : SIDEBAR_DEFAULT_WIDTH
}
