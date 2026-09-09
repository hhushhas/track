import { Bell, FileSearch, Hash, Pencil, Settings2, ShieldCheck, Trash2, TriangleAlert, Users } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { notificationModes } from '#/features/workspace/constants'
import { getGroupAvatar } from '#/features/workspace/group-avatar'

export function ProjectSettingsPage({
  activeProject,
  canDeleteProject,
  canManageProject,
  busyAction,
  globalNotificationMode,
  groupNotificationSettings,
  groups,
  members,
  onDeleteGroup,
  onDeleteProject,
  onEditGroup,
  onEditProject,
  onInvite,
  onNotificationMode,
}: {
  activeProject: Doc<'projects'> | null
  canDeleteProject: boolean
  canManageProject: boolean
  busyAction: string | null
  globalNotificationMode: (typeof notificationModes)[number]
  groupNotificationSettings: Array<Doc<'groupNotificationSettings'>>
  groups: Array<Doc<'groups'>>
  members: Array<{ membership: Doc<'projectMembers'>; user: Doc<'users'> | null }>
  onDeleteGroup: (groupId: Id<'groups'>) => void | Promise<void>
  onDeleteProject: () => void | Promise<void>
  onEditGroup: (group: Doc<'groups'>) => void
  onEditProject: (project: Doc<'projects'>) => void
  onInvite: () => void | Promise<void>
  onNotificationMode: (mode: (typeof notificationModes)[number]) => Promise<void>
}) {
  return (
    <div className="track-settings-page">
      <header className="track-page-intro">
        <p className="mono-label">Project settings</p>
        <h2>Settings</h2>
        <p>Manage project details, access, channels, evidence, and notifications.</p>
      </header>
      <nav aria-label="Project settings sections" className="track-settings-nav">
        <a href="#general">General</a><a href="#members">Members</a><a href="#access">Access</a><a href="#channels">Channels</a><a href="#evidence">Evidence</a><a href="#notifications">Notifications</a><a href="#danger-zone">Danger zone</a>
      </nav>
      <section className="track-settings-panel">
        <div className="track-settings-section" id="general">
          <div className="track-settings-section-head">
            <div>
              <span className="mono-label">General</span>
              <h2>Project identity</h2>
            </div>
            <Settings2 size={15} />
          </div>
          <div className="track-settings-row">
            <span>Name</span>
            <strong>{activeProject?.name ?? 'Untitled project'}</strong>
          </div>
          <div className="track-settings-row">
            <span>Label</span>
            <strong>{activeProject?.clientLabel ?? 'None'}</strong>
          </div>
          <div className="track-settings-row">
            <span>Channels</span>
            <strong>{groups.length}</strong>
          </div>
          {canManageProject && activeProject ? (
            <div className="track-settings-actions">
              <Button className="track-button" onClick={() => onEditProject(activeProject)} type="button">
                <Pencil size={14} />
                Edit project
              </Button>
            </div>
          ) : null}
        </div>

        {canManageProject ? (
          <div className="track-settings-section" id="channels">
            <div className="track-settings-section-head">
              <div>
                <span className="mono-label">Channels</span>
                <h2>Conversation lanes</h2>
              </div>
              <Hash size={14} />
            </div>
            <div className="track-settings-group-list">
              {groups.map((group) => {
                const { Icon, tone } = getGroupAvatar(group)
                return (
                  <div className="track-settings-group-row" key={group._id}>
                    <span className={`track-nav-group-icon ${tone}`}>
                      <Icon size={14} />
                    </span>
                    <span className="track-settings-group-copy">
                      <strong>{group.name}</strong>
                      <small>{group.kind.replaceAll('_', ' ')} channel</small>
                    </span>
                    <Button
                      aria-label={`Edit ${group.name}`}
                      className="track-nav-footer-button"
                      onClick={() => onEditGroup(group)}
                      title={`Edit ${group.name}`}
                      type="button"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      aria-label={`Delete ${group.name}`}
                      className="track-nav-footer-button danger"
                      disabled={busyAction === 'delete-group'}
                      onClick={() => {
                        if (window.confirm(`Delete ${group.name}? This removes its messages, files, and members.`)) {
                          void onDeleteGroup(group._id)
                        }
                      }}
                      title={`Delete ${group.name}`}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )
              })}
              {groups.length === 0 ? <p className="track-settings-empty">No channels yet.</p> : null}
            </div>
          </div>
        ) : null}

        <div className="track-settings-section" id="notifications">
          <div className="track-settings-section-head">
            <div>
              <span className="mono-label">Notifications</span>
              <h2>Default notification mode</h2>
            </div>
            <Bell size={14} />
          </div>
          <ToggleGroup
            className="track-mode-grid"
            value={[globalNotificationMode]}
            onValueChange={(value) => {
              const mode = value.at(-1) as (typeof notificationModes)[number] | undefined
              if (mode && mode !== 'inherit') void onNotificationMode(mode)
            }}
          >
            {notificationModes.filter((mode) => mode !== 'inherit').map((mode) => (
              <ToggleGroupItem
                className={mode === globalNotificationMode ? 'track-chip active' : 'track-chip'}
                key={mode}
                value={mode}
              >
                {mode}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="track-settings-row">
            <span>Channel overrides</span>
            <strong>{groupNotificationSettings.length}</strong>
          </div>
        </div>

        <div className="track-settings-section" id="members">
          <div className="track-settings-section-head">
            <div>
                <span className="mono-label">Members</span>
                <h2>Project members</h2>
            </div>
            <Users size={14} />
          </div>
          <div className="track-settings-row">
            <span>Members</span>
            <strong>{members.length}</strong>
          </div>
          <div className="track-settings-actions">
            <Button className="track-button" onClick={() => void onInvite()} type="button">
              Invite member
            </Button>
          </div>
        </div>

        <div className="track-settings-section" id="access">
          <div className="track-settings-section-head"><div><span className="mono-label">Project access</span><h2>Access and roles</h2><p>Companies, project members, roles, channel access, and pending or archived access remain distinct.</p></div><ShieldCheck size={14} /></div>
          <div className="track-access-groups"><span>Companies</span><strong>Based on represented memberships</strong><span>Roles</span><strong>Manager and member</strong><span>Channel access</span><strong>Managed per channel</strong><span>Pending access</span><strong>Handled through invitations</strong><span>Archived access</span><strong>Read-only when retained</strong></div>
        </div>

        <div className="track-settings-section" id="evidence">
          <div className="track-settings-section-head"><div><span className="mono-label">Evidence</span><h2>Evidence access</h2><p>Evidence follows the access boundary of its source message or thread.</p></div><FileSearch size={14} /></div>
        </div>

        {canManageProject && canDeleteProject && activeProject ? (
          <div className="track-settings-section track-danger-zone" id="danger-zone">
            <div className="track-settings-section-head"><div><span className="mono-label">Danger zone</span><h2>Delete project</h2><p>Permanently removes its channels, messages, files, and members.</p></div><TriangleAlert size={15} /></div>
            <Button className="track-button danger" disabled={busyAction === 'delete-project'} onClick={() => { if (window.confirm(`Delete ${activeProject.name}? This removes its channels, messages, files, and members.`)) void onDeleteProject() }} type="button"><Trash2 size={14} /> Delete project</Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
