import { useMutation } from 'convex/react'
import type { FormEvent } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { WorkspaceInviteRole } from '#/features/workspace/hooks/useWorkspaceDialogState'

export function useWorkspaceDialogActions({
  activeGroup,
  activeGroupId,
  activeProjectId,
  editingGroupId,
  frequencyMinutesInput,
  groupDialogMode,
  groupName,
  inviteAccess,
  inviteCanReview,
  inviteEmail,
  inviteRole,
  onBusyChange,
  onClearError,
  onError,
  onGroupCreated,
  onGroupDeleted,
  onGroupDialogOpenChange,
  onGroupUpdated,
  onInviteDialogOpenChange,
  onProjectDeleted,
  onProjectCreated,
  onProjectDialogOpenChange,
  onProjectUpdated,
  onFrequencyDialogOpenChange,
  projectClientLabel,
  projectDialogMode,
  projectName,
  reviewEnabledInput,
  trackUserId,
}: {
  activeGroup: Doc<'groups'> | undefined
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  editingGroupId: Id<'groups'> | null
  frequencyMinutesInput: string
  groupDialogMode: 'create' | 'edit'
  groupName: string
  inviteAccess: string
  inviteCanReview: boolean
  inviteEmail: string
  inviteRole: WorkspaceInviteRole
  onBusyChange: (label: string | null) => void
  onClearError: () => void
  onError: (error: unknown) => void
  onGroupCreated: (groupId: Id<'groups'>) => void
  onGroupDeleted: (groupId: Id<'groups'>) => void
  onGroupDialogOpenChange: (open: boolean) => void
  onGroupUpdated: (groupId: Id<'groups'>) => void
  onInviteDialogOpenChange: (open: boolean) => void
  onProjectDeleted: (projectId: Id<'projects'>) => void
  onProjectCreated: (projectId: Id<'projects'>) => void
  onProjectDialogOpenChange: (open: boolean) => void
  onProjectUpdated: (projectId: Id<'projects'>) => void
  onFrequencyDialogOpenChange: (open: boolean) => void
  projectClientLabel: string
  projectDialogMode: 'create' | 'edit'
  projectName: string
  reviewEnabledInput: boolean
  trackUserId: Id<'users'> | null
}) {
  const createProject = useMutation(api.projects.create)
  const deleteProject = useMutation(api.projects.remove)
  const updateProject = useMutation(api.projects.update)
  const createGroup = useMutation(api.groups.create)
  const deleteGroup = useMutation(api.groups.remove)
  const updateGroup = useMutation(api.groups.update)
  const createInvitation = useMutation(api.invitations.create)
  const updateGroupAiReviewSettings = useMutation(api.groups.updateAiReviewSettings)

  async function withDialogBusy(label: string, action: () => Promise<void>) {
    onBusyChange(label)
    onClearError()
    try {
      await action()
    } catch (error) {
      onError(error)
    } finally {
      onBusyChange(null)
    }
  }

  async function handleCreateProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId) return
    const name = projectName.trim()
    if (!name) return
    await withDialogBusy(projectDialogMode === 'edit' ? 'edit-project' : 'create-project', async () => {
      if (projectDialogMode === 'edit') {
        if (!activeProjectId) return
        await updateProject({
          projectId: activeProjectId,
          userId: trackUserId,
          name,
          clientLabel: projectClientLabel.trim() || undefined,
        })
        onProjectUpdated(activeProjectId)
        onProjectDialogOpenChange(false)
        return
      }
      const projectId = await createProject({
        userId: trackUserId,
        name,
        clientLabel: projectClientLabel.trim() || undefined,
      })
      onProjectCreated(projectId)
      onProjectDialogOpenChange(false)
    })
  }

  async function handleCreateGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId) return
    const name = groupName.trim()
    if (!name) return
    await withDialogBusy(groupDialogMode === 'edit' ? 'edit-group' : 'create-group', async () => {
      if (groupDialogMode === 'edit') {
        if (!editingGroupId) return
        await updateGroup({
          projectId: activeProjectId,
          groupId: editingGroupId,
          userId: trackUserId,
          name,
        })
        onGroupUpdated(editingGroupId)
        onGroupDialogOpenChange(false)
        return
      }
      const groupId = await createGroup({
        userId: trackUserId,
        projectId: activeProjectId,
        name,
      })
      onGroupCreated(groupId)
      onGroupDialogOpenChange(false)
    })
  }

  async function handleDeleteProject() {
    if (!trackUserId || !activeProjectId) return
    await withDialogBusy('delete-project', async () => {
      const projectId = activeProjectId
      await deleteProject({
        projectId,
        userId: trackUserId,
      })
      onProjectDeleted(projectId)
    })
  }

  async function handleDeleteGroup(groupId: Id<'groups'>) {
    if (!trackUserId || !activeProjectId) return
    await withDialogBusy('delete-group', async () => {
      await deleteGroup({
        projectId: activeProjectId,
        groupId,
        userId: trackUserId,
      })
      onGroupDeleted(groupId)
    })
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId) return
    const email = inviteEmail.trim()
    if (!email) return
    const inviteGroupId = inviteAccess.startsWith('group:')
      ? (inviteAccess.slice('group:'.length) as Id<'groups'>)
      : undefined

    await withDialogBusy('invite', async () => {
      await createInvitation({
        projectId: activeProjectId,
        groupId: inviteGroupId,
        invitedBy: trackUserId,
        email,
        role: inviteRole,
        canReviewAiRecords: inviteCanReview,
      })
      onInviteDialogOpenChange(false)
    })
  }

  async function handleFrequencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId || !activeGroupId || !activeGroup) return
    const frequencyMinutes = Number(frequencyMinutesInput)
    if (!Number.isFinite(frequencyMinutes)) {
      onError(new Error('Frequency must be a number.'))
      return
    }
    await withDialogBusy('review-frequency', async () => {
      await updateGroupAiReviewSettings({
        projectId: activeProjectId,
        groupId: activeGroupId,
        userId: trackUserId,
        enabled: reviewEnabledInput,
        frequencyMinutes,
      })
      onFrequencyDialogOpenChange(false)
    })
  }

  return {
    handleDeleteGroup,
    handleDeleteProject,
    handleCreateGroupSubmit,
    handleCreateProjectSubmit,
    handleFrequencySubmit,
    handleInviteSubmit,
  }
}
