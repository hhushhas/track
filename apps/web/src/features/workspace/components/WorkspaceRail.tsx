import { Bell, Clock3, Download, GripVertical, PanelRightClose, PanelRightOpen, Settings2, Upload } from 'lucide-react'

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
import { RecordStatusDropdown } from '#/features/workspace/records/ProjectRecordsPage'
import { Metric } from '#/features/workspace/thread-items'
import { notificationModes } from '#/features/workspace/constants'
import { notificationPermissionLabels, type WebNotificationPermission } from '#/features/workspace/web-notifications'

type WorkspaceRailProps = {
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  busyAction: string | null
  exportDownloadUrl: string | null | undefined
  globalNotificationMode: (typeof notificationModes)[number]
  groupNotificationMode: (typeof notificationModes)[number]
  latestExportId: Id<'exports'> | null
  latestReview: Doc<'aiReviews'> | null | undefined
  notificationPermission: WebNotificationPermission
  notificationStatus: string | null
  onCollapse: () => void
  onExpand: () => void
  onFrequencyChange: () => void
  onNotificationMode: (mode: (typeof notificationModes)[number]) => void
  onRecordStatus: (recordId: Id<'records'>, status: 'open' | 'in_progress' | 'blocked' | 'done') => Promise<void>
  onRequestExport: (format: 'csv' | 'pdf') => void
  onSendTestNotification: () => void
  onEnableBrowserNotifications: () => void
  onStartResize: () => void
  pendingDraftCount: number
  projectAuditEvents: Array<Doc<'auditEvents'>>
  projectInvitations: Array<Doc<'invitations'>>
  projectRecords: Array<Doc<'records'>>
  railCollapsed: boolean
}

export function WorkspaceRail({
  activeGroupId,
  activeProjectId,
  busyAction,
  exportDownloadUrl,
  globalNotificationMode,
  groupNotificationMode,
  latestExportId,
  latestReview,
  notificationPermission,
  notificationStatus,
  onCollapse,
  onExpand,
  onFrequencyChange,
  onNotificationMode,
  onRecordStatus,
  onRequestExport,
  onSendTestNotification,
  onEnableBrowserNotifications,
  onStartResize,
  pendingDraftCount,
  projectAuditEvents,
  projectInvitations,
  projectRecords,
  railCollapsed,
}: WorkspaceRailProps) {
  if (railCollapsed) {
    return (
      <aside className="track-rail collapsed">
        <button
          aria-label="Expand AI review panel"
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
        aria-label="Resize AI review panel"
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
            <span className="track-rail-heading">AI Review</span>
          </span>
          <div className="track-rail-icon-actions">
            <button
              aria-label="Collapse AI review panel"
              className="track-rail-icon-button"
              onClick={onCollapse}
              type="button"
            >
              <PanelRightClose size={14} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Project record exports"
                className="track-rail-icon-button"
                disabled={!activeProjectId}
              >
                <Download size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="track-rail-menu">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Export project record</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!activeProjectId || busyAction === 'export-csv'}
                    onClick={() => onRequestExport('csv')}
                  >
                    Export csv
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!activeProjectId || busyAction === 'export-pdf'}
                    onClick={() => onRequestExport('pdf')}
                  >
                    Export pdf
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                {exportDownloadUrl || latestExportId ? <DropdownMenuSeparator /> : null}
                {exportDownloadUrl ? (
                  <a className="track-rail-menu-link" href={exportDownloadUrl} rel="noreferrer" target="_blank">
                    Download latest
                  </a>
                ) : latestExportId ? (
                  <span className="track-rail-menu-note">Preparing export...</span>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              aria-label="AI review settings"
              className="track-rail-icon-button"
              disabled={!activeGroupId || busyAction === 'review-frequency'}
              onClick={onFrequencyChange}
              type="button"
            >
              <Settings2 size={14} />
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
        <div className="track-review-status">
          <span>Last run</span>
          <strong>{latestReview?.finishedAt ? new Date(latestReview.finishedAt).toLocaleTimeString() : 'Never'}</strong>
        </div>
        <p className="track-muted track-rail-compact-copy">{latestReview?.summary ?? 'Run AI Review to propose Draft Records from this Group.'}</p>
      </Card>

      <Card className="track-count-grid" size="sm">
        <Metric label="Drafts" value={pendingDraftCount} />
        <Metric label="Records" value={projectRecords.length} />
        <Metric
          label="Billable"
          value={projectRecords.filter((record) => record.classification === 'billable_scope').length}
        />
        <Metric
          label="Open"
          value={projectRecords.filter((record) => record.status === 'open' || record.status === 'in_progress' || record.status === 'blocked').length}
        />
      </Card>

      <Card className="track-rail-section" size="sm">
        <div className="track-rail-heading-row">
          <span className="track-rail-heading">Records</span>
        </div>
        <div className="track-record-list">
          {projectRecords.slice(0, 8).map((record) => (
            <div className="track-record-item" key={record._id}>
              <strong>{record.title}</strong>
              <div className="track-record-item-side">
                <RecordStatusDropdown
                  ariaLabel={`Set status for ${record.title}`}
                  disabled={busyAction === `record-status-${record._id}`}
                  onStatus={(status) => onRecordStatus(record._id, status)}
                  status={record.status}
                />
              </div>
            </div>
          ))}
          {projectRecords.length === 0 ? (
            <p className="track-muted track-record-empty">No project records yet.</p>
          ) : null}
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
