export const RAIL_DEFAULT_WIDTH = 312
export const RAIL_MIN_WIDTH = 280
export const RAIL_MAX_WIDTH = 460
export const RAIL_KEYBOARD_STEP = 16

export function clampRailWidth(width: number) {
  return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, width))
}
