import type { FormEvent } from 'react'

import type { Id } from '../../../../../convex/_generated/dataModel'
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
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Switch } from '#/components/ui/switch'

export function WorkspaceDialogs({
  activeGroupId,
  activeGroupName,
  busyAction,
  frequencyDialogOpen,
  frequencyMinutesInput,
  groupDialogOpen,
  groupName,
  inviteCanReview,
  inviteDialogOpen,
  inviteEmail,
  inviteRole,
  inviteScope,
  projectClientLabel,
  projectDialogOpen,
  projectName,
  setFrequencyDialogOpen,
  setFrequencyMinutesInput,
  setGroupDialogOpen,
  setGroupName,
  setInviteCanReview,
  setInviteDialogOpen,
  setInviteEmail,
  setInviteRole,
  setInviteScope,
  setProjectClientLabel,
  setProjectDialogOpen,
  setProjectName,
  onCreateGroupSubmit,
  onCreateProjectSubmit,
  onFrequencySubmit,
  onInviteSubmit,
}: {
  activeGroupId: Id<'groups'> | null
  activeGroupName?: string
  busyAction: string | null
  frequencyDialogOpen: boolean
  frequencyMinutesInput: string
  groupDialogOpen: boolean
  groupName: string
  inviteCanReview: boolean
  inviteDialogOpen: boolean
  inviteEmail: string
  inviteRole: 'admin' | 'staff' | 'client'
  inviteScope: 'project' | 'group'
  projectClientLabel: string
  projectDialogOpen: boolean
  projectName: string
  setFrequencyDialogOpen: (open: boolean) => void
  setFrequencyMinutesInput: (value: string) => void
  setGroupDialogOpen: (open: boolean) => void
  setGroupName: (value: string) => void
  setInviteCanReview: (value: boolean) => void
  setInviteDialogOpen: (open: boolean) => void
  setInviteEmail: (value: string) => void
  setInviteRole: (value: 'admin' | 'staff' | 'client') => void
  setInviteScope: (value: 'project' | 'group') => void
  setProjectClientLabel: (value: string) => void
  setProjectDialogOpen: (open: boolean) => void
  setProjectName: (value: string) => void
  onCreateGroupSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCreateProjectSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFrequencySubmit: (event: FormEvent<HTMLFormElement>) => void
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
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
                <NativeSelect
                  onChange={(event) => setInviteRole(event.currentTarget.value as typeof inviteRole)}
                  value={inviteRole}
                >
                  <NativeSelectOption value="admin">admin</NativeSelectOption>
                  <NativeSelectOption value="staff">staff</NativeSelectOption>
                  <NativeSelectOption value="client">client</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="track-dialog-field">
                <span>Access</span>
                <NativeSelect
                  onChange={(event) => setInviteScope(event.currentTarget.value as typeof inviteScope)}
                  value={inviteScope}
                >
                  <NativeSelectOption value="project">Project</NativeSelectOption>
                  <NativeSelectOption disabled={!activeGroupId} value="group">
                    Current group: {activeGroupName ?? 'none'}
                  </NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="track-switch-row">
                <span>Can review draft records</span>
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
