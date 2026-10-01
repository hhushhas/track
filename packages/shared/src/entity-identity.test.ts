import { describe, expect, it } from 'vitest'

import { entityMarkColorKeys, entityMarkIconKeys, entityMarkPalette, resolveEntityMark } from './entity-identity'

describe('resolveEntityMark', () => {
  it('uses light, readable surfaces for Company, Project, and Board marks', () => {
    for (const palette of Object.values(entityMarkPalette)) {
      const luminance = (hex: string) => {
        const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
        const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        return linear.length === 3 ? linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722 : 0
      }
      const background = luminance(palette.background)
      const foreground = luminance(palette.foreground)
      expect(background).toBeGreaterThan(0.8)
      expect((background + 0.05) / (foreground + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('is stable across calls and distinguishes the same id in different scopes', () => {
    const first = resolveEntityMark({ id: 'entity-1', kind: 'project', name: 'Project North' })
    expect(resolveEntityMark({ id: 'entity-1', kind: 'project', name: 'Renamed Project' }).colorKey).toBe(first.colorKey)
    expect(resolveEntityMark({ id: 'entity-1', kind: 'company', name: 'Company North' }).colorKey).not.toBe(first.colorKey)
  })

  it('uses semantic name cues for Project and Channel glyphs', () => {
    expect(resolveEntityMark({ id: 'p1', kind: 'project', name: 'Mobile Engineering' }).iconKey).toBe('code')
    expect(resolveEntityMark({ id: 'c1', kind: 'channel', name: 'Design discussion' }).iconKey).toBe('design')
    expect(resolveEntityMark({ id: 'c2', kind: 'channel', name: 'General' }).iconKey).toBe('conversation')
  })

  it('falls back safely for missing or invalid customization keys', () => {
    const result = resolveEntityMark({
      colorKey: 'danger',
      iconKey: 'trash',
      id: 'p1',
      kind: 'project',
      name: 'Project',
    })
    expect(entityMarkColorKeys).toContain(result.colorKey)
    expect(entityMarkIconKeys).toContain(result.iconKey)
  })

  it('uses valid configured icon and color tokens', () => {
    expect(resolveEntityMark({
      colorKey: 'teal',
      iconKey: 'launch',
      id: 'p1',
      kind: 'project',
      name: 'Project',
    })).toMatchObject({ colorKey: 'teal', iconKey: 'launch' })
  })
})
