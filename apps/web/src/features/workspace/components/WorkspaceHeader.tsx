import type { ChangeEvent, RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Columns3, Menu, MessageSquare, MessageSquarePlus, Search } from 'lucide-react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { AvatarNameTooltip } from '#/features/workspace/avatar-tooltip'
import { getAvatarTone, getInitials } from '#/features/workspace/identity'
import { useReleaseConfig } from '#/lib/release-config'

type ProjectItem = {
  project: Doc<'projects'>
  membership: Doc<'projectMembers'>
}

type ProjectMemberItem = {
  membership: Doc<'projectMembers'>
  user: Doc<'users'> | null
}

type WorkspaceHeaderProps = {
  activeGroup: Doc<'groups'> | undefined
  activeProject: ProjectItem | undefined
  activeProjectId: Id<'projects'> | null
  busyAction: string | null
  extraHeaderMemberCount: number
  fileInputRef: RefObject<HTMLInputElement | null>
  headerMemberAvatarUrlById: Map<string, string>
  headerMembers: Array<ProjectMemberItem>
  hiddenHeaderMembers: Array<ProjectMemberItem>
  onCreateGroup: () => void
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onInvite: () => void
  onMobileNavOpen: () => void
  onSearchToggle: () => void
  view: 'home' | 'project' | 'group' | 'settings'
}

export function WorkspaceHeader({
  activeGroup,
  activeProject,
  activeProjectId,
  busyAction,
  extraHeaderMemberCount,
  fileInputRef,
  headerMemberAvatarUrlById,
  headerMembers,
  hiddenHeaderMembers,
  onCreateGroup,
  onFileSelected,
  onInvite,
  onMobileNavOpen,
  onSearchToggle,
  view,
}: WorkspaceHeaderProps) {
  const releaseConfig = useReleaseConfig()
  const channelTasks = useQuery(
    api.tasks.list,
    releaseConfig.tasks && activeGroup
      ? { projectId: activeGroup.projectId, groupId: activeGroup._id }
      : 'skip',
  ) as Array<{ terminal: boolean }> | undefined
  const channelBoards = useQuery(
    api.taskBoards.list,
    releaseConfig.tasks && activeGroup
      ? { projectId: activeGroup.projectId }
      : 'skip',
  ) as Array<{ board: Doc<'taskBoards'> }> | undefined
  const activeChannelBoard = channelBoards?.find(
    (item) => item.board.groupId === activeGroup?._id && item.board.isDefault,
  ) ?? channelBoards?.find((item) => item.board.groupId === activeGroup?._id)
  const openChannelTaskCount = channelTasks?.filter((item) => !item.terminal).length ?? 0
  return (
    <header className="track-thread-header">
      <Button
        aria-label="Open navigation"
        className="icon-button track-mobile-menu-button"
        onClick={onMobileNavOpen}
        type="button"
      >
        <Menu size={16} />
      </Button>
      <div className="track-header-title">
        <h1>
          {view === 'group' && activeGroup
            ? `#${activeGroup.name}`
              : view === 'settings' && activeProject
                ? `${activeProject.project.name} Settings`
                : activeProject
                  ? `${activeProject.project.name} Channels`
                  : 'Select a Project'}
        </h1>
        {view === 'group' && activeProject ? (
          <span className="track-header-topic">
            {activeProject.project.name}{activeProject.project.clientLabel ? ` · ${activeProject.project.clientLabel}` : ''}
          </span>
        ) : null}
      </div>
      {view === 'group' && activeProjectId && releaseConfig.tasks ? (
        <nav aria-label="Channel views" className="track-header-view-tabs">
          <span aria-current="page" className="active">
            <MessageSquare size={13} /> Conversation
          </span>
          <Link
            params={{ projectId: activeProjectId }}
            search={{ board: activeChannelBoard?.board._id, view: 'board' }}
            to="/workspace/projects/$projectId/tasks"
          >
            <Columns3 size={13} /> Board <span className="track-header-tab-count">{openChannelTaskCount}</span>
          </Link>
        </nav>
      ) : null}
      <div className="track-header-actions">
        <div className="track-header-members" aria-label="Project members">
          {headerMembers.map((item) => {
            const user = item.user as Doc<'users'>
            return (
              <AvatarNameTooltip
                avatarUrl={headerMemberAvatarUrlById.get(user._id)}
                bannerStyle={user.profileBannerStyle}
                bio={user.profileBio}
                detail={user.profileDesignation ?? item.membership.role.replaceAll('_', ' ')}
                key={user._id}
                name={user.displayName}
                toneSource={user.email}
                timezone={user.timezone}
              >
                <Avatar className={`track-avatar ${getAvatarTone(user.email)}`}>
                  <AvatarImage src={headerMemberAvatarUrlById.get(user._id)} />
                  <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
              </AvatarNameTooltip>
            )
          })}
          {extraHeaderMemberCount > 0 ? (
            <AvatarNameTooltip
              detail={hiddenHeaderMembers
                .map((item) => item.user?.displayName)
                .filter(Boolean)
                .slice(0, 4)
                .join(', ')}
              name={`${extraHeaderMemberCount} more member${extraHeaderMemberCount === 1 ? '' : 's'}`}
            >
              <span className="track-member-more">+{extraHeaderMemberCount}</span>
            </AvatarNameTooltip>
          ) : null}
        </div>
        {view === 'group' ? (
          <>
            <Button
              aria-label="Search this chat"
              className="icon-button"
              onClick={onSearchToggle}
              title="Search this chat (/)"
              type="button"
            >
              <Search size={15} />
            </Button>
            <Input
              className="track-file-input"
              onChange={onFileSelected}
              multiple
              ref={fileInputRef}
              type="file"
            />
          </>
        ) : null}
        {view !== 'settings' ? (
          <Button
            className="track-button"
            disabled={!activeProjectId || busyAction === 'invite'}
            onClick={onInvite}
            type="button"
          >
            Invite
          </Button>
        ) : null}
        {view === 'group' ? null : view === 'project' ? (
          <Button
            className="track-button track-button-accent"
            disabled={!activeProjectId || busyAction === 'create-group'}
            onClick={onCreateGroup}
            type="button"
          >
            <MessageSquarePlus size={14} />
            New Channel
          </Button>
        ) : null}
      </div>
    </header>
  )
}
