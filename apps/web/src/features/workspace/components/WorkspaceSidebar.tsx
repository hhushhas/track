import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Building2, ChevronDown, FolderKanban, ListTodo, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, UserRound, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { api } from '../../../../../../convex/_generated/api'
import ThemeToggle from '#/components/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { AvatarNameTooltip } from '#/features/workspace/avatar-tooltip'
import { getGroupAvatar } from '#/features/workspace/group-avatar'
import { getAvatarTone, getInitials } from '#/features/workspace/identity'
import { useReleaseConfig } from '#/lib/release-config'

type ProjectItem = {
  project: Doc<'projects'>
  membership: Doc<'projectMembers'>
  company?: { _id: Id<'companies'>; displayName: string } | null
  projectType?: 'legacy' | 'company' | 'shared'
}

type WorkspaceSidebarProps = {
  activeGroupId: Id<'groups'> | null
  activeProject: ProjectItem | undefined
  activeProjectId: Id<'projects'> | null
  busyAction: string | null
  currentAvatarUrl: string | null | undefined
  currentUserBannerStyle: string | null | undefined
  currentUserDesignation: string
  currentUserEmail: string
  currentUserName: string
  currentUserId: Id<'users'>
  logoutConfirmOpen: boolean
  mobileNavOpen: boolean
  navCollapsed: boolean
  onCreateGroup: () => void
  onCreateProject: () => void
  onLogoutConfirmOpenChange: (open: boolean | ((open: boolean) => boolean)) => void
  onMobileNavOpenChange: (open: boolean) => void
  onNavigateProjectSettings: () => void
  onNavCollapsedChange: (collapsed: boolean | ((collapsed: boolean) => boolean)) => void
  onOpenProjectSearch: () => void
  onPreloadGroupRoute: (groupId: Id<'groups'>) => void
  onPreloadProjectRoute: (projectId: Id<'projects'>, companyId?: Id<'companies'>, projectMemberId?: Id<'projectMembers'>) => void
  onPreloadProjectSettingsRoute: () => void
  onSelectGroup: (groupId: Id<'groups'>) => void
  onSelectProject: (projectId: Id<'projects'>, companyId?: Id<'companies'>, projectMemberId?: Id<'projectMembers'>) => void
  onSignOut: () => void
  projectItems: Array<ProjectItem>
  view: 'home' | 'project' | 'channels' | 'group' | 'evidence' | 'settings'
  visibleGroups: Array<Doc<'groups'>>
}

export function WorkspaceSidebar({
  activeGroupId,
  activeProject,
  activeProjectId,
  busyAction,
  currentAvatarUrl,
  currentUserBannerStyle,
  currentUserDesignation,
  currentUserEmail,
  currentUserName,
  currentUserId,
  logoutConfirmOpen,
  mobileNavOpen,
  navCollapsed,
  onCreateGroup,
  onCreateProject,
  onLogoutConfirmOpenChange,
  onMobileNavOpenChange,
  onNavigateProjectSettings,
  onNavCollapsedChange,
  onOpenProjectSearch,
  onPreloadGroupRoute,
  onPreloadProjectRoute,
  onPreloadProjectSettingsRoute,
  onSelectGroup,
  onSelectProject,
  onSignOut,
  projectItems,
  view,
  visibleGroups,
}: WorkspaceSidebarProps) {
  const mobileNavRef = useRef<HTMLElement>(null)
  const releaseConfig = useReleaseConfig()
  const threadUnread = useQuery(
    api.channelThreads.listGroupUnread,
    releaseConfig.threads && activeProjectId && activeProject?.projectType === 'legacy'
      ? { projectId: activeProjectId, userId: currentUserId }
      : 'skip',
  )
  const threadUnreadByGroup = new Map(
    (threadUnread ?? []).map((item) => [item.groupId, item.unreadCount]),
  )

  useEffect(() => {
    if (!mobileNavOpen) return
    const mobileViewport = window.matchMedia('(max-width: 760px)')
    if (!mobileViewport.matches) {
      onMobileNavOpenChange(false)
      return
    }
    const drawer = mobileNavRef.current
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')
    if (!drawer) return
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer.querySelector<HTMLButtonElement>('.track-mobile-nav-close')?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onMobileNavOpenChange(false)
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    function handleViewportChange(event: MediaQueryListEvent) {
      if (!event.matches) onMobileNavOpenChange(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    mobileViewport.addEventListener('change', handleViewportChange)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)
      mobileViewport.removeEventListener('change', handleViewportChange)
      if (mobileViewport.matches) {
        trigger?.focus()
      } else {
        requestAnimationFrame(() => {
          const visibleDesktopTarget = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
            .find((element) => element.offsetParent !== null)
          visibleDesktopTarget?.focus()
        })
      }
    }
  }, [mobileNavOpen, onMobileNavOpenChange])

  return (
    <>
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="track-mobile-nav-scrim"
          onClick={() => onMobileNavOpenChange(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label={mobileNavOpen ? 'Workspace navigation' : undefined}
        aria-modal={mobileNavOpen || undefined}
        className={[
          'track-nav',
          mobileNavOpen ? 'mobile-open' : '',
          navCollapsed ? 'collapsed' : '',
        ].filter(Boolean).join(' ')}
        ref={mobileNavRef}
        role={mobileNavOpen ? 'dialog' : undefined}
      >
        <div className="track-brand">
          <img
            alt=""
            className="track-brand-mark"
            height={24}
            src="/track-mark.svg"
            width={35}
          />
          <span className="track-brand-word">Track</span>
          <button
            aria-label="Close navigation"
            className="track-mobile-nav-close"
            onClick={() => onMobileNavOpenChange(false)}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={navCollapsed}
            className="track-nav-collapse-button"
            onClick={() => onNavCollapsedChange((isCollapsed) => !isCollapsed)}
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            type="button"
          >
            {navCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        <div className="track-current-project">
          <span className="track-nav-section-label">Project</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Switch project: ${activeProject?.project.name ?? 'Select a project'}`}
              className="track-current-project-card"
              disabled={!projectItems.length}
              title={navCollapsed ? activeProject?.project.name ?? 'Select a project' : undefined}
            >
              <FolderKanban className="track-nav-icon" size={14} />
              <span className="track-nav-copy">
                <span className="track-nav-title">{activeProject?.project.name ?? 'Select a project'}</span>
                <span className="track-nav-meta">{activeProject ? `${activeProject.membership.companyDisplayNameSnapshot ?? activeProject.project.clientLabel ?? 'Independent project'} · ${activeProject.membership.role}` : 'No project selected'}</span>
              </span>
              <ChevronDown className="track-nav-icon track-project-chevron" size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="track-project-switcher-menu" side="right" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch project</DropdownMenuLabel>
                {projectItems.map((item) => (
                  <DropdownMenuItem
                    className={item.project._id === activeProjectId ? 'track-project-switcher-item active' : 'track-project-switcher-item'}
                    key={item.project._id}
                    onFocus={() => onPreloadProjectRoute(item.project._id, item.company?._id, item.membership._id)}
                    onClick={() => onSelectProject(item.project._id, item.company?._id, item.membership._id)}
                    onPointerEnter={() => onPreloadProjectRoute(item.project._id, item.company?._id, item.membership._id)}
                    onTouchStart={() => onPreloadProjectRoute(item.project._id, item.company?._id, item.membership._id)}
                  >
                    <span className="track-menu-project-name">{item.project.name}</span>
                    <span className="track-menu-project-role">{item.membership.role}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="track-project-switcher-create" onClick={onCreateProject}>
                <Plus size={13} />
                Create project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {releaseConfig.companyModel ? <div className="track-nav-secondary company-nav-link"><Link className="track-nav-item" to="/workspace/company"><Building2 className="track-nav-icon" size={14} /><span className="track-nav-copy"><span className="track-nav-title">Back to company</span><span className="track-nav-meta">Relationships and shared work</span></span></Link></div> : null}

        {activeProjectId ? (
          <div className="track-nav-secondary">
            <div className="track-sidebar-groups">
              <div className="track-nav-section">
                <span>Channels</span>
                <button
                  aria-label="Create channel"
                  className="track-nav-action"
                  disabled={busyAction === 'create-group'}
                  onClick={onCreateGroup}
                  title="Create channel"
                  type="button"
                >
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
              <div className="track-nav-list">
                {visibleGroups.map((group) => {
                  const { Icon, tone } = getGroupAvatar(group)
                  return (
                    <Button
                      className={group._id === activeGroupId ? 'track-nav-item compact active' : 'track-nav-item compact'}
                      key={group._id}
                      onFocus={() => onPreloadGroupRoute(group._id)}
                      onClick={() => onSelectGroup(group._id)}
                      onPointerEnter={() => onPreloadGroupRoute(group._id)}
                      onTouchStart={() => onPreloadGroupRoute(group._id)}
                      title={`# ${group.name}${group.status === 'archived' ? ' (archived)' : ''}`}
                      type="button"
                    >
                      <span className={`track-nav-group-icon ${tone}`}>
                        <Icon size={14} strokeWidth={2.1} />
                      </span>
                      <span className="track-nav-copy">
                        <span className="track-nav-title"># {group.name}</span>
                        {threadUnreadByGroup.get(group._id) ? <span className="track-nav-meta">
                          {threadUnreadByGroup.get(group._id)} unread {threadUnreadByGroup.get(group._id) === 1 ? 'thread' : 'threads'}
                        </span> : null}
                      </span>
                    </Button>
                  )
                })}
                {visibleGroups.length === 0 ? (
                  <span className="track-nav-empty">No channels yet</span>
                ) : null}
              </div>
            </div>

            <div className="track-sidebar-tools">
              <div className="track-nav-section no-action">
                <span>Work</span>
              </div>
              <Button
                className="track-nav-item"
                disabled={!activeProjectId}
                onClick={onOpenProjectSearch}
                title={navCollapsed ? 'Search' : undefined}
                type="button"
              >
                <Search className="track-nav-icon" size={14} />
                <span className="track-nav-copy">
                  <span className="track-nav-title">Search</span>
                  <span className="track-nav-meta">Messages and files</span>
                </span>
              </Button>
              {releaseConfig.tasks ? (
                <Link
                  activeProps={{ className: 'track-nav-item active' }}
                  className="track-nav-item"
                  params={{ projectId: activeProjectId }}
                  search={{ view: 'board' }}
                  title={navCollapsed ? 'Tasks' : undefined}
                  to="/workspace/projects/$projectId/tasks"
                >
                  <ListTodo className="track-nav-icon" size={14} />
                  <span className="track-nav-copy">
                    <span className="track-nav-title">Tasks</span>
                    <span className="track-nav-meta">Boards, my tasks, inbox</span>
                  </span>
                </Link>
              ) : null}
              <Button
                className={view === 'settings' ? 'track-nav-item active' : 'track-nav-item'}
                onFocus={onPreloadProjectSettingsRoute}
                onClick={onNavigateProjectSettings}
                onPointerEnter={onPreloadProjectSettingsRoute}
                onTouchStart={onPreloadProjectSettingsRoute}
                title={navCollapsed ? 'Settings' : undefined}
                type="button"
              >
                <Settings2 className="track-nav-icon" size={14} />
                <span className="track-nav-copy">
                  <span className="track-nav-title">Settings</span>
                  <span className="track-nav-meta">Members, notifications</span>
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="track-nav-footer">
          {navCollapsed ? (
            <>
              <Button
                aria-expanded={logoutConfirmOpen}
                aria-label={`Account menu for ${currentUserName}`}
                className="track-nav-account-button"
                onClick={() => onLogoutConfirmOpenChange((isOpen) => !isOpen)}
                title={`${currentUserName} account`}
                type="button"
              >
                <Avatar className={`track-avatar ${getAvatarTone(currentUserEmail)}`}>
                  <AvatarImage src={currentAvatarUrl ?? undefined} />
                  <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
                </Avatar>
              </Button>
              {logoutConfirmOpen ? (
                <div className="track-account-menu" role="dialog" aria-label="Account menu">
                  <div className="track-account-menu-user">
                    <strong>{currentUserName}</strong>
                    <span>{currentUserDesignation}</span>
                  </div>
                  <div className="track-account-menu-actions">
                    <Button
                      aria-label="Profile settings"
                      className="track-nav-footer-button"
                      onClick={() => { window.location.href = '/profile' }}
                      title="Profile settings"
                      type="button"
                    >
                      <UserRound size={14} />
                    </Button>
                    <ThemeToggle />
                    <Button
                      aria-label="Log out"
                      className="track-nav-footer-button"
                      onClick={onSignOut}
                      title="Log out"
                      type="button"
                    >
                      <LogOut size={14} />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <AvatarNameTooltip
              avatarUrl={currentAvatarUrl}
              bannerStyle={currentUserBannerStyle}
              detail={currentUserDesignation}
              name={currentUserName}
              side="right"
              toneSource={currentUserEmail}
            >
              <Avatar className={`track-avatar ${getAvatarTone(currentUserEmail)}`}>
                <AvatarImage src={currentAvatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
              </Avatar>
            </AvatarNameTooltip>
          )}
          <div className="track-nav-copy">
            <span className="track-nav-title">{currentUserName}</span>
            <span className="track-nav-meta">{currentUserDesignation}</span>
          </div>
          {!navCollapsed ? (
            <div className="track-nav-footer-actions">
              <Button
                aria-label="Profile settings"
                className="track-nav-footer-button"
                onClick={() => { window.location.href = '/profile' }}
                title="Profile settings"
                type="button"
              >
                <UserRound size={14} />
              </Button>
              <ThemeToggle />
              <Button
                aria-expanded={logoutConfirmOpen}
                aria-label="Log out"
                className="track-nav-footer-button"
                onClick={() => onLogoutConfirmOpenChange((isOpen) => !isOpen)}
                title="Log out"
                type="button"
              >
                <LogOut size={14} />
              </Button>
              {logoutConfirmOpen ? (
                <div className="track-logout-confirm" role="dialog" aria-label="Confirm logout">
                  <p>Log out of Track?</p>
                  <div className="track-logout-confirm-actions">
                    <Button
                      className="track-button subtle"
                      onClick={() => onLogoutConfirmOpenChange(false)}
                      type="button"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="track-button track-button-primary"
                      onClick={onSignOut}
                      type="button"
                    >
                      Log out
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
