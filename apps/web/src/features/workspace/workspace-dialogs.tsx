import type { FormEvent } from 'react'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { getGroupAvatar } from './group-avatar'

export function WorkspaceDialogs({
  activeGroupId,
  busyAction,
  frequencyDialogOpen,
  frequencyMinutesInput,
  groupDialogOpen,
  groupName,
  inviteCanReview,
  inviteDialogOpen,
  inviteEmail,
  inviteRole,
  inviteAccess,
  projectClientLabel,
  projectDialogOpen,
  projectGroups,
  projectName,
  reviewEnabledInput,
  setFrequencyDialogOpen,
  setFrequencyMinutesInput,
  setGroupDialogOpen,
  setGroupName,
  setInviteCanReview,
  setInviteDialogOpen,
  setInviteEmail,
  setInviteRole,
  setInviteAccess,
  setProjectClientLabel,
  setProjectDialogOpen,
  setProjectName,
  setReviewEnabledInput,
  onCreateGroupSubmit,
  onCreateProjectSubmit,
  onFrequencySubmit,
  onInviteSubmit,
}: {
  activeGroupId: Id<'groups'> | null
  busyAction: string | null
  frequencyDialogOpen: boolean
  frequencyMinutesInput: string
  groupDialogOpen: boolean
  groupName: string
  inviteCanReview: boolean
  inviteDialogOpen: boolean
  inviteEmail: string
  inviteRole: 'admin' | 'staff' | 'client'
  inviteAccess: string
  projectClientLabel: string
  projectDialogOpen: boolean
  projectGroups: Array<Doc<'groups'>>
  projectName: string
  reviewEnabledInput: boolean
  setFrequencyDialogOpen: (open: boolean) => void
  setFrequencyMinutesInput: (value: string) => void
  setGroupDialogOpen: (open: boolean) => void
  setGroupName: (value: string) => void
  setInviteCanReview: (value: boolean) => void
  setInviteDialogOpen: (open: boolean) => void
  setInviteEmail: (value: string) => void
  setInviteRole: (value: 'admin' | 'staff' | 'client') => void
  setInviteAccess: (value: string) => void
  setProjectClientLabel: (value: string) => void
  setProjectDialogOpen: (open: boolean) => void
  setProjectName: (value: string) => void
  setReviewEnabledInput: (value: boolean) => void
  onCreateGroupSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCreateProjectSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFrequencySubmit: (event: FormEvent<HTMLFormElement>) => void
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const selectedInviteGroup = inviteAccess.startsWith('group:')
    ? projectGroups.find((group) => `group:${group._id}` === inviteAccess)
    : null
  const selectedInviteGroupAvatar = selectedInviteGroup ? getGroupAvatar(selectedInviteGroup) : null
  const SelectedInviteGroupIcon = selectedInviteGroupAvatar?.Icon

  return (
    <>
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="track-dialog">
          <form onSubmit={onCreateProjectSubmit}>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>Add a workspace for a client/vendor project.</DialogDescription>
            </DialogHeader>
            <div className="track-dialog-fields">
              <label className="track-dialog-field">
                <span>Project name</span>
                <Input
                  autoFocus
                  onChange={(event) => setProjectName(event.currentTarget.value)}
                  value={projectName}
                />
              </label>
              <label className="track-dialog-field">
                <span>Client label</span>
                <Input
                  onChange={(event) => setProjectClientLabel(event.currentTarget.value)}
                  value={projectClientLabel}
                />
              </label>
            </div>
            <DialogFooter>
              <Button className="track-button" type="button" onClick={() => setProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="track-button track-button-primary"
                disabled={!projectName.trim() || busyAction === 'create-project'}
                type="submit"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="track-dialog">
          <form onSubmit={onCreateGroupSubmit}>
            <DialogHeader>
              <DialogTitle>Create group</DialogTitle>
              <DialogDescription>Add a conversation lane inside the active project.</DialogDescription>
            </DialogHeader>
            <div className="track-dialog-fields">
              <label className="track-dialog-field">
                <span>Group name</span>
                <Input
                  autoFocus
                  onChange={(event) => setGroupName(event.currentTarget.value)}
                  value={groupName}
                />
              </label>
            </div>
            <DialogFooter>
              <Button className="track-button" type="button" onClick={() => setGroupDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="track-button track-button-primary"
                disabled={!groupName.trim() || busyAction === 'create-group'}
                type="submit"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="track-dialog">
          <form onSubmit={onInviteSubmit}>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>Send access to this project, or only the current group.</DialogDescription>
            </DialogHeader>
            <div className="track-dialog-fields">
              <label className="track-dialog-field">
                <span>Email</span>
                <Input
                  autoFocus
                  onChange={(event) => setInviteEmail(event.currentTarget.value)}
                  type="email"
                  value={inviteEmail}
                />
              </label>
              <label className="track-dialog-field">
                <span>Role</span>
                <Select
                  onValueChange={(value) => setInviteRole((value ?? 'staff') as typeof inviteRole)}
                  value={inviteRole}
                >
                  <SelectTrigger className="track-dialog-select-trigger">
                    <span className="track-dialog-select-value">{inviteRole}</span>
                  </SelectTrigger>
                  <SelectContent className="track-dialog-select-content">
                    <SelectGroup>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label className="track-dialog-field">
                <span>Access</span>
                <Select
                  onValueChange={(value) => setInviteAccess(value ?? 'project')}
                  value={inviteAccess}
                >
                  <SelectTrigger className="track-dialog-select-trigger">
                    {selectedInviteGroup && selectedInviteGroupAvatar && SelectedInviteGroupIcon ? (
                      <span className="track-invite-access-trigger">
                        <span className={`track-nav-group-icon ${selectedInviteGroupAvatar.tone}`}>
                          <SelectedInviteGroupIcon size={14} />
                        </span>
                        <span className="track-dialog-select-value">{selectedInviteGroup.name}</span>
                      </span>
                    ) : (
                      <span className="track-dialog-select-value">Entire project</span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="track-dialog-select-content">
                    <SelectGroup>
                      <SelectItem value="project">Entire project</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Groups</SelectLabel>
                      {projectGroups.length > 0 ? (
                        projectGroups.map((group) => {
                          const { Icon, tone } = getGroupAvatar(group)
                          return (
                            <SelectItem
                              key={group._id}
                              label={group.name}
                              value={`group:${group._id}`}
                            >
                              <span className={`track-nav-group-icon ${tone}`}>
                                <Icon size={14} />
                              </span>
                              <span className="track-invite-access-option">
                                <strong>{group.name}</strong>
                                <small>
                                  {group._id === activeGroupId ? 'Current group' : `${group.kind.replaceAll('_', ' ')} group`}
                                </small>
                              </span>
                            </SelectItem>
                          )
                        })
                      ) : (
                        <SelectItem disabled value="no-groups">
                          No groups yet
                        </SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label className="track-switch-row">
                <span>
                  <span className="track-switch-title-muted">Can review draft records</span>
                  <small>Allows this member to accept, edit, or ignore AI draft records.</small>
                </span>
                <Switch checked={inviteCanReview} onCheckedChange={setInviteCanReview} />
              </label>
            </div>
            <DialogFooter>
              <Button className="track-button" type="button" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="track-button track-button-primary"
                disabled={!inviteEmail.trim() || busyAction === 'invite'}
                type="submit"
              >
                Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={frequencyDialogOpen} onOpenChange={setFrequencyDialogOpen}>
        <DialogContent className="track-dialog">
          <form onSubmit={onFrequencySubmit}>
            <DialogHeader>
              <DialogTitle>AI review cadence</DialogTitle>
              <DialogDescription>Set how often Track reviews the current group.</DialogDescription>
            </DialogHeader>
            <div className="track-dialog-fields">
              <label className="track-switch-row">
                <span>AI review enabled</span>
                <Switch checked={reviewEnabledInput} onCheckedChange={setReviewEnabledInput} />
              </label>
              <label className="track-dialog-field">
                <span>Minutes</span>
                <Input
                  autoFocus
                  inputMode="numeric"
                  onChange={(event) => setFrequencyMinutesInput(event.currentTarget.value)}
                  value={frequencyMinutesInput}
                />
              </label>
            </div>
            <DialogFooter>
              <Button className="track-button" type="button" onClick={() => setFrequencyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="track-button track-button-primary"
                disabled={!frequencyMinutesInput.trim() || busyAction === 'review-frequency'}
                type="submit"
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
