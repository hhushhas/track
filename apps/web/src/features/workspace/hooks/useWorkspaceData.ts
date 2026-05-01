import { useQuery } from 'convex/react'
import { useMemo } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import { filterVisibleProjectGroups } from '#/features/workspace/lib/route-state'
import type { ProjectRecordFilter } from '#/features/workspace/records/filtering'
import { filterProjectRecords } from '#/features/workspace/records/filtering'
import type { ProjectSearchFilter } from '#/features/workspace/search/ProjectSearchDialog'

export function useWorkspaceData({
  activeGroupId,
  activeProjectId,
  projectSearchFilter,
  projectSearchOpen,
  projectSearchQuery,
  recordFilter,
  recordSearchQuery,
  trackUserId,
}: {
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  projectSearchFilter: ProjectSearchFilter
  projectSearchOpen: boolean
  projectSearchQuery: string
  recordFilter: ProjectRecordFilter
  recordSearchQuery: string
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
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 80 }
      : 'skip',
  )
  const drafts = useQuery(
    api.records.listDrafts,
    trackUserId && activeProjectId && confirmedActiveGroupId
      ? { userId: trackUserId, projectId: activeProjectId, groupId: confirmedActiveGroupId }
      : 'skip',
  )
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
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
  const latestReview = useQuery(
    api.ai.latestForGroup,
    trackUserId && confirmedActiveGroupId ? { userId: trackUserId, groupId: confirmedActiveGroupId } : 'skip',
  )
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 20 }
      : 'skip',
  )
  const auditEvents = useQuery(
    api.audit.listProjectEvents,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId, limit: 30 }
      : 'skip',
  )
  const invitations = useQuery(
    api.invitations.listForProject,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
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
  const groupDrafts = useMemo(() => (drafts ?? []) as Array<Doc<'draftRecords'>>, [drafts])
  const projectRecords = useMemo(() => (records ?? []) as Array<Doc<'records'>>, [records])
  const filteredProjectRecords = useMemo(
    () => filterProjectRecords(projectRecords, recordFilter, recordSearchQuery),
    [projectRecords, recordFilter, recordSearchQuery],
  )
  const groupAssistantStreams = useMemo(
    () => (assistantStreams ?? []) as Array<Doc<'assistantStreams'>>,
    [assistantStreams],
  )
  const projectAuditEvents = useMemo(
    () => (auditEvents ?? []) as Array<Doc<'auditEvents'>>,
    [auditEvents],
  )
  const projectInvitations = useMemo(
    () => (invitations ?? []) as Array<Doc<'invitations'>>,
    [invitations],
  )
  const activeProject = projectItems.find((item) => item.project._id === activeProjectId)
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId)

  return {
    activeGroup,
    activeProject,
    activeProjectMembers,
    confirmedActiveGroupId,
    currentAvatarUrl,
    currentTrackProfileIncomplete,
    currentTrackUser,
    drafts,
    filteredProjectRecords,
    groupAssistantStreams,
    groupDrafts,
    groupMessages,
    groups,
    latestReview,
    messages,
    projectAuditEvents,
    projectInvitations,
    projectItems,
    projectMemberRoleByUserId,
    projectMembers,
    projectRecords,
    projectSearchResults,
    projects,
    visibleGroups,
  }
}
