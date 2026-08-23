import { describe, expect, it } from 'vitest'

import { isActiveChannelMembership } from './channel-membership'

describe('isActiveChannelMembership', () => {
  it('treats missing-status legacy rows as active but ended rows as inactive', () => {
    expect(isActiveChannelMembership({}, 'legacy')).toBe(true)
    expect(isActiveChannelMembership({ status: 'active' }, 'legacy')).toBe(true)
    expect(isActiveChannelMembership({ status: 'removed' }, 'legacy')).toBe(false)
    expect(isActiveChannelMembership({ status: 'suspended' }, 'legacy')).toBe(false)
    expect(isActiveChannelMembership({ status: 'archived' }, 'legacy')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2 }, 'legacy')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2, status: 'active' }, 'legacy')).toBe(false)
  })

  it('requires explicit active status for Company rows and excludes ended rows', () => {
    expect(isActiveChannelMembership({ status: 'active' }, 'company')).toBe(true)
    expect(isActiveChannelMembership({}, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'removed' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'suspended' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'archived' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2 }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2, status: 'active' }, 'company')).toBe(false)
  })
})
