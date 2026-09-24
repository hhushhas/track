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

  it('allows an owner to manage and promote an active non-owner', () => {
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'owner',
      isCurrentUser: false,
      targetRole: 'admin',
      targetStatus: 'active',
    })).toEqual({
      canChangeRole: true,
      canChangeStatus: true,
      canPromoteToOwner: true,
      showMenu: true,
    })
  })

  it('does not expose management actions to a company member', () => {
    expect(resolveCompanyMemberActionCapabilities({
      actorRole: 'member',
      isCurrentUser: false,
      targetRole: 'member',
      targetStatus: 'active',
    })).toEqual({
      canChangeRole: false,
      canChangeStatus: false,
      canPromoteToOwner: false,
      showMenu: false,
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
