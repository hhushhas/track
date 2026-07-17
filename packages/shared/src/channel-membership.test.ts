import { describe, expect, it } from 'vitest'

import { isActiveChannelMembership } from './channel-membership'

describe('isActiveChannelMembership', () => {
  it('treats historical legacy rows without status as active', () => {
    expect(isActiveChannelMembership({}, 'legacy')).toBe(true)
    expect(isActiveChannelMembership({ status: 'active' }, 'legacy')).toBe(true)
  })

  it.each(['removed', 'suspended', 'archived'] as const)(
    'excludes legacy rows with %s status',
    (status) => expect(isActiveChannelMembership({ status }, 'legacy')).toBe(false),
  )

  it('excludes ended legacy rows even when their status is absent or active', () => {
    expect(isActiveChannelMembership({ endedAt: 2 }, 'legacy')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2, status: 'active' }, 'legacy')).toBe(false)
  })

  it('requires an explicit active status for company-model rows', () => {
    expect(isActiveChannelMembership({ status: 'active' }, 'company')).toBe(true)
    expect(isActiveChannelMembership({}, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'removed' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'suspended' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ status: 'archived' }, 'company')).toBe(false)
    expect(isActiveChannelMembership({ endedAt: 2, status: 'active' }, 'company')).toBe(false)
  })
})
