import { describe, expect, it } from 'vitest'

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
  getStoredSidebarWidth,
} from './sidebar-sizing'

describe('sidebar sizing', () => {
  it('keeps the navigation within its usable desktop range', () => {
    expect(clampSidebarWidth(120)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(268)).toBe(268)
    expect(clampSidebarWidth(500)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('uses a safe default for missing or invalid stored widths', () => {
    expect(getStoredSidebarWidth(null)).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(getStoredSidebarWidth('   ')).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(getStoredSidebarWidth('not-a-number')).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(getStoredSidebarWidth('280')).toBe(280)
  })
})
