import { describe, expect, it } from 'vitest'

import { getActiveMention, getInitials, getMentionHandle } from './identity'

describe('workspace identity helpers', () => {
  it('normalizes display names into mention handles', () => {
    expect(getMentionHandle('@Hasan Shoaib')).toBe('hasan-shoaib')
    expect(getMentionHandle(' Client.Owner+Ops ')).toBe('client.owner-ops')
    expect(getInitials('')).toBe('T')
    expect(getInitials('Track')).toBe('TR')
    expect(getInitials('Hasan Shoaib')).toBe('HS')
  })

  it('detects the active mention at the current cursor only', () => {
    expect(getActiveMention('Please ask @track', 17)).toEqual({
      start: 11,
      end: 17,
      query: 'track',
    })
    expect(getActiveMention('hello @track and team', 21)).toBeNull()
  })
})
