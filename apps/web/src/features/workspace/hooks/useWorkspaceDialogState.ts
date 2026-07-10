import { useState } from 'react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'

export type WorkspaceInviteRole = 'admin' | 'staff' | 'client'

export function useWorkspaceDialogState({
  activeGroupId,
}: {
  activeGroupId: Id<'groups'> | null
}) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create')
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'edit'>('create')
  const [editingGroupId, setEditingGroupId] = useState<Id<'groups'> | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectClientLabel, setProjectClientLabel] = useState('')
  const [groupName, setGroupName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>('staff')
  const [inviteAccess, setInviteAccess] = useState('project')

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
    setInviteAccess(activeGroupId ? `group:${activeGroupId}` : 'project')
    setInviteDialogOpen(true)
  }


  return {
    editingGroupId,
    groupDialogOpen,
    groupDialogMode,
    groupName,
    inviteAccess,
    inviteDialogOpen,
    inviteEmail,
    inviteRole,
    openEditGroupDialog,
    openEditProjectDialog,
    openGroupDialog,
    openInviteDialog,
    openProjectDialog,
    projectClientLabel,
    projectDialogOpen,
    projectDialogMode,
    projectName,
    setGroupDialogOpen,
    setGroupName,
    setInviteAccess,
    setInviteDialogOpen,
    setInviteEmail,
    setInviteRole,
    setProjectClientLabel,
    setProjectDialogOpen,
    setProjectName,
  }
}
