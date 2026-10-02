import { ArrowUpRight, Bell, GripVertical, PanelRightClose, PanelRightOpen, Paperclip } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { formatRailLabel } from '#/features/workspace/lib/formatting'
import { notificationModes } from '#/features/workspace/constants'
import { notificationPermissionLabels, type WebNotificationPermission } from '#/features/workspace/web-notifications'
import { RAIL_KEYBOARD_STEP, RAIL_MAX_WIDTH, RAIL_MIN_WIDTH, clampRailWidth } from '#/features/workspace/rail-sizing'
import { CompanyThreadBrowser } from '#/features/threads/CompanyThreadBrowser'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import { useReleaseConfig } from '#/lib/release-config'
import { AttachmentTypeIcon } from '../attachment-ui'

type WorkspaceRailProps = {
  activeGroup: Doc<'groups'> | undefined
  activeCompanyId?: Id<'companies'>
  activeCompanyName?: string
  activeProjectName?: string
  activeProjectId: Id<'projects'> | null
  projectMemberId?: Id<'projectMembers'>
  busyAction: string | null
  globalNotificationMode: (typeof notificationModes)[number]
  groupNotificationMode: (typeof notificationModes)[number]
  notificationPermission: WebNotificationPermission
  notificationStatus: string | null
  onCollapse: () => void
  onExpand: () => void
  onNotificationMode: (mode: (typeof notificationModes)[number]) => void
  onSendTestNotification: () => void
  onEnableBrowserNotifications: () => void
  onStartResize: () => void
  onRailWidthChange: (width: number) => void
  railWidth: number
  railCollapsed: boolean
  userId: Id<'users'>
  visibleMessages: Array<GroupMessageItem>
}

type NotificationMenuProps = Pick<
  WorkspaceRailProps,
  | 'activeProjectId'
  | 'busyAction'
  | 'globalNotificationMode'
  | 'groupNotificationMode'
  | 'notificationPermission'
  | 'notificationStatus'
  | 'onEnableBrowserNotifications'
  | 'onNotificationMode'
  | 'onSendTestNotification'
>

function NotificationMenu({
  activeProjectId,
  busyAction,
  globalNotificationMode,
  groupNotificationMode,
  notificationPermission,
  notificationStatus,
  onEnableBrowserNotifications,
  onNotificationMode,
  onSendTestNotification,
}: NotificationMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notification settings"
        className="track-rail-icon-button"
        disabled={!activeProjectId}
      >
        <Bell size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="track-rail-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <p className="track-rail-menu-note">Browser: {notificationPermissionLabels[notificationPermission]}</p>
          <DropdownMenuItem
            disabled={busyAction === 'notifications' || busyAction === 'test-notifications'}
            onClick={onEnableBrowserNotifications}
          >
            {notificationPermission === 'granted' ? 'Reconnect browser alerts' : 'Enable browser alerts'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busyAction === 'notifications' || busyAction === 'test-notifications'}
            onClick={onSendTestNotification}
          >
            Send test alert
          </DropdownMenuItem>
          {notificationStatus ? <p className="track-rail-menu-note">{notificationStatus}</p> : null}
          <DropdownMenuSeparator />
          <p className="track-rail-menu-note">Global: {formatRailLabel(globalNotificationMode)}</p>
          <DropdownMenuRadioGroup
            value={groupNotificationMode}
            onValueChange={(mode) => onNotificationMode(mode as (typeof notificationModes)[number])}
          >
            {notificationModes.map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {formatRailLabel(mode)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function WorkspaceRail({
  activeGroup,
  activeCompanyId,
  activeCompanyName,
  activeProjectName,
  activeProjectId,
  busyAction,
  globalNotificationMode,
  groupNotificationMode,
  notificationPermission,
  notificationStatus,
  onCollapse,
  onExpand,
  onNotificationMode,
  onSendTestNotification,
  onEnableBrowserNotifications,
  onStartResize,
  onRailWidthChange,
  projectMemberId,
  railWidth,
  railCollapsed,
  userId,
  visibleMessages,
}: WorkspaceRailProps) {
  const releaseConfig = useReleaseConfig()
  const references = visibleMessages
    .flatMap((item) => item.attachments.map((file) => ({
      ...file,
      author: item.author?.displayName ?? 'Unknown member',
      createdAt: item.message.createdAt,
    })))
    .slice(-4)
    .reverse()
  if (railCollapsed) {
    return (
      <aside aria-label="Workspace details" className="track-rail collapsed">
        <div className="track-rail-collapsed-actions">
          <button
            aria-label="Expand workspace details"
            className="track-rail-collapse-button"
            onClick={onExpand}
            type="button"
          >
            <PanelRightOpen size={15} />
          </button>
          <NotificationMenu
            activeProjectId={activeProjectId}
            busyAction={busyAction}
            globalNotificationMode={globalNotificationMode}
            groupNotificationMode={groupNotificationMode}
            notificationPermission={notificationPermission}
            notificationStatus={notificationStatus}
            onEnableBrowserNotifications={onEnableBrowserNotifications}
            onNotificationMode={onNotificationMode}
            onSendTestNotification={onSendTestNotification}
          />
        </div>
      </aside>
    )
  }

  return (
    <aside aria-label="Channel context" className="track-rail">
      <div
        aria-label="Resize Channel context panel"
        aria-orientation="vertical"
        aria-valuemax={RAIL_MAX_WIDTH}
        aria-valuemin={RAIL_MIN_WIDTH}
        aria-valuenow={railWidth}
        aria-valuetext={`${railWidth} pixels`}
        className="track-rail-resize-handle"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            onRailWidthChange(clampRailWidth(railWidth + RAIL_KEYBOARD_STEP))
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            onRailWidthChange(clampRailWidth(railWidth - RAIL_KEYBOARD_STEP))
          }
          if (event.key === 'Home') {
            event.preventDefault()
            onRailWidthChange(RAIL_MIN_WIDTH)
          }
          if (event.key === 'End') {
            event.preventDefault()
            onRailWidthChange(RAIL_MAX_WIDTH)
          }
        }}
        onPointerDown={(event) => {
          event.preventDefault()
          onStartResize()
        }}
        role="separator"
        tabIndex={0}
        title="Drag to resize. Use the left and right arrow keys to adjust."
      >
        <span aria-hidden="true" className="track-rail-resize-grip">
          <GripVertical size={14} />
        </span>
      </div>
      <div className="track-rail-toolbar">
        <button
          aria-label="Collapse workspace details"
          className="track-rail-icon-button"
          onClick={onCollapse}
          type="button"
        >
          <PanelRightClose size={14} />
        </button>
        <NotificationMenu
          activeProjectId={activeProjectId}
          busyAction={busyAction}
          globalNotificationMode={globalNotificationMode}
          groupNotificationMode={groupNotificationMode}
          notificationPermission={notificationPermission}
          notificationStatus={notificationStatus}
          onEnableBrowserNotifications={onEnableBrowserNotifications}
          onNotificationMode={onNotificationMode}
          onSendTestNotification={onSendTestNotification}
        />
      </div>
      <header className="track-rail-context-header">
        <div>
          <span className="track-rail-kicker">Channel context</span>
          <h2>{activeGroup ? `#${activeGroup.name}` : 'Project context'}</h2>
          <p>{[activeCompanyName, activeProjectName].filter(Boolean).join(' · ') || 'References and focused threads stay scoped to this Project.'}</p>
        </div>
      </header>
      <section className="track-rail-section track-rail-reference-section">
        <div className="track-rail-heading-row">
          <div className="track-rail-heading-copy">
            <h2 className="track-rail-heading">Recent references</h2>
            <p>Files shared in this channel</p>
          </div>
          {references.length ? <span className="track-rail-section-count">{references.length}</span> : null}
        </div>
        <div className="track-rail-reference-list">
          {references.map(({ attachment, author, createdAt, url }) => {
            const sharedAt = new Date(createdAt)
            const content = (
              <>
                <span className="track-rail-reference-icon">
                  <AttachmentTypeIcon contentType={attachment.contentType} filename={attachment.filename} />
                </span>
                <span className="track-rail-reference-copy">
                  <strong title={attachment.filename}>{attachment.filename}</strong>
                  <small><span>{author}</span><span aria-hidden="true">·</span><time dateTime={sharedAt.toISOString()}>{sharedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></small>
                </span>
                {url ? <ArrowUpRight aria-hidden="true" className="track-rail-reference-open" size={14} /> : null}
              </>
            )
            return url ? (
              <a aria-label={`Open ${attachment.filename} in a new tab`} href={url} key={attachment._id} rel="noreferrer" target="_blank">{content}</a>
            ) : (
              <span className="track-rail-reference" key={attachment._id}>{content}</span>
            )
          })}
          {!references.length ? (
            <div className="track-rail-reference-empty" role="status">
              <span><Paperclip aria-hidden="true" size={15} /></span>
              <div><strong>No references yet</strong><p>Files shared in this channel will stay easy to find here.</p></div>
            </div>
          ) : null}
        </div>
      </section>
      {activeProjectId ? (
        <CompanyThreadBrowser
          companyName={activeCompanyName}
          context={activeCompanyId && projectMemberId ? { actingCompanyId: activeCompanyId, projectMemberId } : undefined}
          projectId={activeProjectId}
          userId={userId}
        />
      ) : activeGroup && !releaseConfig.threads ? (
        <section className="track-feature-unavailable" role="status">
          <strong>Threads are unavailable</strong>
          <span>This project feature is disabled for the current environment.</span>
        </section>
      ) : null}
    </aside>
  )
}
