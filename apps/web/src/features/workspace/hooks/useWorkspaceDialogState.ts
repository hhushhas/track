import { useState } from 'react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'

export type WorkspaceInviteRole = 'admin' | 'staff' | 'client'

export function useWorkspaceDialogState({
  activeGroup,
  activeGroupId,
}: {
  activeGroup: Doc<'groups'> | undefined
  activeGroupId: Id<'groups'> | null
}) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create')
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'edit'>('create')
  const [editingGroupId, setEditingGroupId] = useState<Id<'groups'> | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [frequencyDialogOpen, setFrequencyDialogOpen] = useState(false)
  const [reviewEnabledInput, setReviewEnabledInput] = useState(true)
  const [projectName, setProjectName] = useState('')
  const [projectClientLabel, setProjectClientLabel] = useState('')
  const [groupName, setGroupName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>('staff')
  const [inviteCanReview, setInviteCanReview] = useState(true)
  const [inviteAccess, setInviteAccess] = useState('project')
  const [frequencyMinutesInput, setFrequencyMinutesInput] = useState('30')

  function openProjectDialog() {
    setProjectDialogMode('create')
    setProjectName('')
    setProjectClientLabel('')
    setProjectDialogOpen(true)
  }

  function openEditProjectDialog(project: Doc<'projects'>) {
    setProjectDialogMode('edit')
    setProjectName(project.name)
    setProjectClientLabel(project.clientLabel ?? '')
    setProjectDialogOpen(true)
  }

  function openGroupDialog() {
    setGroupDialogMode('create')
    setEditingGroupId(null)
    setGroupName('')
    setGroupDialogOpen(true)
  }

  function openEditGroupDialog(group: Doc<'groups'>) {
    setGroupDialogMode('edit')
    setEditingGroupId(group._id)
    setGroupName(group.name)
    setGroupDialogOpen(true)
  }

  function openInviteDialog() {
    setInviteEmail('')
    setInviteRole('staff')
    setInviteCanReview(true)
    setInviteAccess(activeGroupId ? `group:${activeGroupId}` : 'project')
    setInviteDialogOpen(true)
  }

  function openFrequencyDialog() {
    const current = activeGroup?.aiReviewSettings?.frequencyMinutes ?? 30
    setReviewEnabledInput(activeGroup?.aiReviewSettings?.enabled ?? true)
    setFrequencyMinutesInput(String(current))
    setFrequencyDialogOpen(true)
  }

  return {
    frequencyDialogOpen,
    frequencyMinutesInput,
    editingGroupId,
    groupDialogOpen,
    groupDialogMode,
    groupName,
    inviteAccess,
    inviteCanReview,
    inviteDialogOpen,
    inviteEmail,
    inviteRole,
    openEditGroupDialog,
    openEditProjectDialog,
    openFrequencyDialog,
    openGroupDialog,
    openInviteDialog,
    openProjectDialog,
    projectClientLabel,
    projectDialogOpen,
    projectDialogMode,
    projectName,
    reviewEnabledInput,
    setFrequencyDialogOpen,
    setFrequencyMinutesInput,
    setGroupDialogOpen,
    setGroupName,
    setInviteAccess,
    setInviteCanReview,
    setInviteDialogOpen,
    setInviteEmail,
    setInviteRole,
    setProjectClientLabel,
    setProjectDialogOpen,
    setProjectName,
    setReviewEnabledInput,
  }
}
