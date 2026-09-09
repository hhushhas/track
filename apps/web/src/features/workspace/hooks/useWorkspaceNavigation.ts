import { useNavigate, useRouter } from '@tanstack/react-router'
import type { Dispatch, SetStateAction } from 'react'

import type { Id } from '../../../../../../convex/_generated/dataModel'

export function useWorkspaceNavigation({
  activeProjectId,
  setActiveGroupId,
  setMobileNavOpen,
}: {
  activeProjectId: Id<'projects'> | null
  setActiveGroupId: Dispatch<SetStateAction<Id<'groups'> | null>>
  setMobileNavOpen: Dispatch<SetStateAction<boolean>>
}) {
  const navigate = useNavigate()
  const router = useRouter()

  function navigateToProject(projectId: Id<'projects'>, companyId?: Id<'companies'>, projectMemberId?: Id<'projectMembers'>) {
    setMobileNavOpen(false)
    setActiveGroupId(null)
    if (companyId && projectMemberId) {
      void navigate({
        to: '/workspace/company-projects/$projectId',
        params: { projectId },
        search: { companyId, groupId: '', membershipId: projectMemberId, view: 'channels' },
      })
      return
    }
    void navigate({
      to: '/workspace/projects/$projectId',
      params: { projectId },
    })
  }

  function preloadProjectRoute(projectId: Id<'projects'>, companyId?: Id<'companies'>, projectMemberId?: Id<'projectMembers'>) {
    if (companyId && projectMemberId) {
      void router.preloadRoute({
        to: '/workspace/company-projects/$projectId',
        params: { projectId },
        search: { companyId, groupId: '', membershipId: projectMemberId, view: 'channels' },
      }).catch(() => undefined)
      return
    }
    void router.preloadRoute({
      to: '/workspace/projects/$projectId',
      params: { projectId },
    }).catch(() => undefined)
  }

  function navigateToGroup(groupId: Id<'groups'>) {
    if (!activeProjectId) return
    setMobileNavOpen(false)
    setActiveGroupId(groupId)
    void navigate({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId, projectId: activeProjectId },
    })
  }

  function preloadGroupRoute(groupId: Id<'groups'>) {
    if (!activeProjectId) return
    void router.preloadRoute({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId, projectId: activeProjectId },
    }).catch(() => undefined)
  }

  function navigateToProjectSettings() {
    if (!activeProjectId) return
    setMobileNavOpen(false)
    setActiveGroupId(null)
    void navigate({
      to: '/workspace/projects/$projectId/settings',
      params: { projectId: activeProjectId },
    })
  }

  function preloadProjectSettingsRoute() {
    if (!activeProjectId) return
    void router.preloadRoute({
      to: '/workspace/projects/$projectId/settings',
      params: { projectId: activeProjectId },
    }).catch(() => undefined)
  }

  return {
    navigateToGroup,
    navigateToProject,
    navigateToProjectSettings,
    preloadGroupRoute,
    preloadProjectRoute,
    preloadProjectSettingsRoute,
  }
}
