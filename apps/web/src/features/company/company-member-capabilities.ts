import type { CompanyRole, ProjectMemberStatus } from '@track/shared/company'

export type CompanyMemberActionCapabilities = Readonly<{
  canChangeRole: boolean
  canChangeStatus: boolean
  canPromoteToOwner: boolean
  showMenu: boolean
}>

export function resolveCompanyMemberActionCapabilities({
  actorRole,
  isCurrentUser,
  targetRole,
  targetStatus,
}: {
  actorRole: CompanyRole
  isCurrentUser: boolean
  targetRole: CompanyRole
  targetStatus: ProjectMemberStatus
}): CompanyMemberActionCapabilities {
  if (actorRole === 'member' || isCurrentUser || targetStatus === 'removed') {
    return {
      canChangeRole: false,
      canChangeStatus: false,
      canPromoteToOwner: false,
      showMenu: false,
    }
  }

  const actorIsOwner = actorRole === 'owner'
  const targetIsOwner = targetRole === 'owner'
  const canManageTarget = actorIsOwner || !targetIsOwner

  return {
    canChangeRole: canManageTarget,
    canChangeStatus: canManageTarget,
    canPromoteToOwner: actorIsOwner && !targetIsOwner && targetStatus === 'active',
    showMenu: canManageTarget,
  }
}
