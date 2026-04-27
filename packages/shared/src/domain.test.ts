import { describe, expect, it } from 'vitest'

import { parseMentions, roleCanJoinDefaultGroup, shouldNotifyForMessage } from './domain'

describe('Track shared domain contracts', () => {
  it('keeps clients out of internal and commercials default groups', () => {
    expect(roleCanJoinDefaultGroup('client', 'general')).toBe(true)
    expect(roleCanJoinDefaultGroup('client', 'internal')).toBe(false)
    expect(roleCanJoinDefaultGroup('client', 'commercials')).toBe(false)
  })

  it('parses unique mentions from chat text', () => {
    expect(parseMentions('hey @track ask @Hasan and @track')).toEqual(['track', 'hasan'])
  })

  it('lets group notification settings override global settings', () => {
    expect(
      shouldNotifyForMessage({
        globalMode: 'none',
        groupMode: 'mentions',
        mentioned: true,
      }),
    ).toBe(true)
    expect(
      shouldNotifyForMessage({
        globalMode: 'all',
        groupMode: 'none',
        mentioned: true,
      }),
    ).toBe(false)
  })
})
