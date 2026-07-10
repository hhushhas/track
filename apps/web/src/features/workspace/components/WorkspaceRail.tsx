import { Bell, Clock3, GripVertical, PanelRightClose, PanelRightOpen, Upload } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Card } from '#/components/ui/card'
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

type WorkspaceRailProps = {
  activeProjectId: Id<'projects'> | null
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
  projectAuditEvents: Array<Doc<'auditEvents'>>
  projectInvitations: Array<Doc<'invitations'>>
  railCollapsed: boolean
}

export function WorkspaceRail({
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
  projectAuditEvents,
  projectInvitations,
  railCollapsed,
}: WorkspaceRailProps) {
  if (railCollapsed) {
    return (
      <aside className="track-rail collapsed">
        <button
          aria-label="Expand workspace details"
          className="track-rail-collapse-button"
          onClick={onExpand}
          type="button"
        >
          <PanelRightOpen size={15} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="track-rail">
      <button
        aria-label="Resize workspace details"
        className="track-rail-resize-handle"
        onPointerDown={(event) => {
          event.preventDefault()
          onStartResize()
        }}
        type="button"
      >
        <span className="track-rail-resize-grip">
          <GripVertical size={14} />
        </span>
      </button>
      <Card className="track-rail-section" size="sm">
        <div className="track-rail-title">
          <span>
            <span className="track-rail-heading">Workspace</span>
          </span>
          <div className="track-rail-icon-actions">
            <button
              aria-label="Collapse workspace details"
              className="track-rail-icon-button"
              onClick={onCollapse}
              type="button"
            >
              <PanelRightClose size={14} />
            </button>
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
          </div>
        </div>
      </Card>

      <Card className="track-rail-section" size="sm">
        <div className="track-rail-heading-row">
          <span className="track-rail-heading">Invitations</span>
          <Upload size={14} />
        </div>
        <div className="track-audit-list">
          {projectInvitations.slice(0, 5).map((invite) => (
            <p key={invite._id}>
              <span>{invite.email}</span>
              <small>{invite.role} · {invite.status}</small>
            </p>
          ))}
          {projectInvitations.length === 0 ? <p className="track-muted">No invites yet.</p> : null}
        </div>
      </Card>

      <Card className="track-rail-section" size="sm">
        <div className="track-rail-heading-row">
          <span className="track-rail-heading">Audit Trail</span>
          <Clock3 size={14} />
        </div>
        <div className="track-audit-list">
          {projectAuditEvents.slice(0, 8).map((event) => (
            <p key={event._id}>
              <span>{event.action}</span>
              <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
            </p>
          ))}
        </div>
      </Card>
    </aside>
  )
}
