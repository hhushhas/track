import { useQuery } from 'convex/react'
import { useMemo } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import { getActiveChannelMembers } from '#/features/workspace/lib/channel-header-members'
import { filterVisibleProjectGroups } from '#/features/workspace/lib/route-state'
import type { ProjectSearchFilter } from '#/features/workspace/search/ProjectSearchDialog'

export function useWorkspaceData({
  activeGroupId,
  activeProjectId,
  projectSearchFilter,
  projectSearchOpen,
  projectSearchQuery,
  trackUserId,
}: {
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  projectSearchFilter: ProjectSearchFilter
  projectSearchOpen: boolean
  projectSearchQuery: string
  trackUserId: Id<'users'> | null
}) {
  const currentTrackUser = useQuery(
    api.auth.getUser,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const currentAvatarUrl = useQuery(
    api.auth.getAvatarUrl,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const currentTrackProfileIncomplete = Boolean(
    currentTrackUser &&
      (!currentTrackUser.displayName?.trim() ||
        !currentTrackUser.profileDesignation?.trim() ||
        !currentTrackUser.timezone?.trim()),
  )

  const projects = useQuery(
    api.projects.list,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const groups = useQuery(
    api.groups.listVisible,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const projectMembers = useQuery(
    api.projects.listMembers,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const visibleGroups = useMemo(
    () => filterVisibleProjectGroups((groups ?? []) as Array<Doc<'groups'>>, activeProjectId),
    [activeProjectId, groups],
  )
  const confirmedActiveGroupId =
    groups !== undefined && activeGroupId && visibleGroups.some((group) => group._id === activeGroupId)
      ? activeGroupId
      : null
  const channelMembers = useQuery(
    api.groups.listMembers,
    trackUserId && confirmedActiveGroupId
      ? { groupId: confirmedActiveGroupId, userId: trackUserId }
      : 'skip',
  )
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 80 }
      : 'skip',
  )
  const projectSearchResults = useQuery(
    api.search.project,
    trackUserId && activeProjectId && projectSearchOpen && projectSearchQuery.trim().length >= 2
      ? {
          filter: projectSearchFilter,
          limit: 8,
          projectId: activeProjectId,
          query: projectSearchQuery,
          userId: trackUserId,
        }
      : 'skip',
  )
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 20 }
      : 'skip',
  )
  const projectItems = useMemo(
    () =>
      (projects ?? []) as Array<{
        project: Doc<'projects'>
        membership: Doc<'projectMembers'>
      }>,
    [projects],
  )
  const activeProjectMembers = useMemo(
    () =>
      (projectMembers ?? []) as Array<{
        membership: Doc<'projectMembers'>
        user: Doc<'users'> | null
      }>,
    [projectMembers],
  )
  const projectMemberRoleByUserId = useMemo(() => {
    const roles = new Map<string, Doc<'projectMembers'>['role']>()
    for (const item of activeProjectMembers) {
      if (item.user) roles.set(item.user._id, item.membership.role)
    }
    return roles
  }, [activeProjectMembers])
  const groupMessages = useMemo(
    () => (messages ?? []) as Array<GroupMessageItem>,
    [messages],
  )
  const groupAssistantStreams = useMemo(
    () => (assistantStreams ?? []) as Array<Doc<'assistantStreams'>>,
    [assistantStreams],
  )
  const activeProject = projectItems.find((item) => item.project._id === activeProjectId)
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId)
  const activeChannelMembers = useMemo(
    () => getActiveChannelMembers(
      confirmedActiveGroupId,
      channelMembers ?? [],
    ),
    [channelMembers, confirmedActiveGroupId],
  )

  return {
    activeChannelMembers,
    activeGroup,
    activeProject,
    activeProjectMembers,
    confirmedActiveGroupId,
    currentAvatarUrl,
    currentTrackProfileIncomplete,
    currentTrackUser,
    channelMembers,
    groupAssistantStreams,
    groupMessages,
    groups,
    messages,
    projectItems,
    projectMemberRoleByUserId,
    projectMembers,
    projectSearchResults,
    projects,
    visibleGroups,
  }
}
