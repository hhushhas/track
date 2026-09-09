import type { ChangeEvent, RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, MessageSquarePlus, PanelRight, Search } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { AvatarNameTooltip } from '#/features/workspace/avatar-tooltip'
import { getAvatarTone, getInitials } from '#/features/workspace/identity'
import type { ActiveChannelMemberItem } from '#/features/workspace/lib/channel-header-members'
import { useReleaseConfig } from '#/lib/release-config'

type ProjectItem = {
  project: Doc<'projects'>
  membership: Doc<'projectMembers'>
}

type WorkspaceHeaderProps = {
  activeGroup: Doc<'groups'> | undefined
  activeProject: ProjectItem | undefined
  activeProjectId: Id<'projects'> | null
  busyAction: string | null
  extraHeaderMemberCount: number
  fileInputRef: RefObject<HTMLInputElement | null>
  headerMemberAvatarUrlById: Map<string, string>
  headerMembers: Array<ActiveChannelMemberItem>
  hiddenHeaderMembers: Array<ActiveChannelMemberItem>
  onCreateGroup: () => void
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onInvite: () => void
  onMobileNavOpen: () => void
  onMobileRailOpen: () => void
  onSearchToggle: () => void
  view: 'home' | 'project' | 'channels' | 'group' | 'evidence' | 'settings'
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
  onMobileRailOpen,
  onSearchToggle,
  view,
}: WorkspaceHeaderProps) {
  const releaseConfig = useReleaseConfig()
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
          {view === 'home'
            ? 'Workspace'
            : view === 'group' && activeGroup
            ? `#${activeGroup.name}`
              : view === 'settings' && activeProject
                ? `${activeProject.project.name} settings`
                : view === 'evidence' && activeProject
                  ? `${activeProject.project.name} evidence`
                  : view === 'channels' && activeProject
                    ? `${activeProject.project.name} channels`
                    : activeProject
                      ? activeProject.project.name
                  : 'Select a Project'}
        </h1>
        {view === 'group' && activeProject ? (
          <span className="track-header-topic">
            {activeProject.project.name}{activeProject.project.clientLabel ? ` · ${activeProject.project.clientLabel}` : ''}
          </span>
        ) : null}
      </div>
      {activeProjectId ? (
        <nav aria-label="Project views" className="track-header-view-tabs">
          <Link aria-current={view === 'project' ? 'page' : undefined} className={view === 'project' ? 'active' : ''} params={{ projectId: activeProjectId }} to="/workspace/projects/$projectId">Overview</Link>
          {releaseConfig.tasks ? <Link params={{ projectId: activeProjectId }} search={{ view: 'board' }} to="/workspace/projects/$projectId/tasks">Board</Link> : null}
          {releaseConfig.tasks ? <Link params={{ projectId: activeProjectId }} search={{ view: 'all' }} to="/workspace/projects/$projectId/tasks">List</Link> : null}
          <Link aria-current={view === 'channels' || view === 'group' ? 'page' : undefined} className={view === 'channels' || view === 'group' ? 'active' : ''} params={{ projectId: activeProjectId }} to="/workspace/projects/$projectId/channels">Channels</Link>
          <Link aria-current={view === 'evidence' ? 'page' : undefined} className={view === 'evidence' ? 'active' : ''} params={{ projectId: activeProjectId }} to="/workspace/projects/$projectId/evidence">Evidence</Link>
          <Link aria-current={view === 'settings' ? 'page' : undefined} className={view === 'settings' ? 'active' : ''} params={{ projectId: activeProjectId }} to="/workspace/projects/$projectId/settings">Settings</Link>
        </nav>
      ) : null}
      <div className="track-header-actions">
        <div className="track-header-members" aria-label="Channel members">
          {headerMembers.map((item) => {
            const user = item.user
            return (
              <AvatarNameTooltip
                avatarUrl={headerMemberAvatarUrlById.get(user._id)}
                bannerStyle={user.profileBannerStyle}
                bio={user.profileBio}
                detail={user.profileDesignation ?? 'Channel member'}
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
              name={`${extraHeaderMemberCount} more Channel member${extraHeaderMemberCount === 1 ? '' : 's'}`}
            >
              <span className="track-member-more">+{extraHeaderMemberCount}</span>
            </AvatarNameTooltip>
          ) : null}
        </div>
        {view === 'group' ? (
          <>
            <Button aria-label="Open project controls" className="icon-button track-mobile-controls-button" onClick={onMobileRailOpen} title="Project controls" type="button"><PanelRight size={15} /></Button>
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
        {view === 'group' ? null : view === 'channels' ? (
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
