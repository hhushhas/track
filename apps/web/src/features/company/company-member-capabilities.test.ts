import { describe, expect, it } from 'vitest'

import { resolveCompanyMemberActionCapabilities } from './company-member-capabilities'

describe('company member action capabilities', () => {
  it('does not expose owner actions to a company admin', () => {
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'admin',
      isCurrentUser: false,
      targetRole: 'owner',
      targetStatus: 'active',
    })).toEqual({
      canChangeRole: false,
      canChangeStatus: false,
      canPromoteToOwner: false,
      showMenu: false,
    })
  })

  it('allows an admin to manage a non-owner member', () => {
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'admin',
      isCurrentUser: false,
      targetRole: 'member',
      targetStatus: 'active',
    })).toMatchObject({
      canChangeRole: true,
      canChangeStatus: true,
      showMenu: true,
    })
  })

  it('does not expose actions for the current or removed member', () => {
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'owner',
      isCurrentUser: true,
      targetRole: 'owner',
      targetStatus: 'active',
    }).showMenu).toBe(false)
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'owner',
      isCurrentUser: false,
      targetRole: 'member',
      targetStatus: 'removed',
    }).showMenu).toBe(false)
  })
})
