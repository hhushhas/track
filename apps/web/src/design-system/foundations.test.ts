import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  TRACK_UI_BREAKPOINTS,
  TRACK_UI_LAYOUT,
  TRACK_UI_MESSAGE_ACTION_ORDER,
  TRACK_UI_SPACING,
  isTrackSpacing,
} from './foundations'

describe('Track UI foundation contract', () => {
  it('keeps spacing on the documented 4px rhythm', () => {
    expect(TRACK_UI_SPACING).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64])
    expect(TRACK_UI_SPACING.every((value) => value % 4 === 0)).toBe(true)
    expect(isTrackSpacing(24)).toBe(true)
    expect(isTrackSpacing(22)).toBe(false)
  })

  it('keeps responsive layout thresholds in increasing order', () => {
    expect(TRACK_UI_BREAKPOINTS.mobile).toBeLessThan(TRACK_UI_BREAKPOINTS.navigation)
    expect(TRACK_UI_BREAKPOINTS.navigation).toBeLessThan(TRACK_UI_BREAKPOINTS.contextRail)
    expect(TRACK_UI_BREAKPOINTS.contextRail).toBeLessThan(TRACK_UI_BREAKPOINTS.wide)
  })

  it('keeps the workspace columns usable at the context-rail breakpoint', () => {
    const requiredWidth = TRACK_UI_LAYOUT.navigationWidth + TRACK_UI_LAYOUT.contextRailWidth + 480
    expect(requiredWidth).toBeLessThanOrEqual(TRACK_UI_BREAKPOINTS.contextRail)
    expect(TRACK_UI_LAYOUT.navigationCollapsedWidth).toBeGreaterThanOrEqual(44)
  })

  it('keeps frequent message actions before forwarding and overflow', () => {
    expect(TRACK_UI_MESSAGE_ACTION_ORDER).toEqual([
      'reply',
      'create-task',
      'forward',
      'more',
    ])
  })

  it('keeps the authoritative CSS free of broad transition declarations', () => {
    const css = readFileSync(join(process.cwd(), 'src/design-system/professional-ui.css'), 'utf8')
    expect(css).toContain('--surface-canvas:')
    expect(css).toContain('--space-6: 24px;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).not.toMatch(/transition\s*:\s*all\b/)
  })
})
