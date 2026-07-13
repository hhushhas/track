import { Bell, GripVertical, PanelRightClose, PanelRightOpen } from 'lucide-react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
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
  railCollapsed: boolean
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
  railCollapsed,
}: WorkspaceRailProps) {
  if (railCollapsed) {
    return (
      <aside className="track-rail collapsed">
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
        </div>
      </Card>
    </aside>
  )
}
