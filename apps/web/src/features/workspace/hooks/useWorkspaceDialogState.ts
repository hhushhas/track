import { useState } from 'react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { EntityMarkColorKey, EntityMarkIconKey } from '@track/shared'

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
  const [projectMarkIconKey, setProjectMarkIconKey] = useState<EntityMarkIconKey | ''>('')
  const [projectMarkColorKey, setProjectMarkColorKey] = useState<EntityMarkColorKey | ''>('')
  const [groupName, setGroupName] = useState('')
  const [groupMarkIconKey, setGroupMarkIconKey] = useState<EntityMarkIconKey | ''>('')
  const [groupMarkColorKey, setGroupMarkColorKey] = useState<EntityMarkColorKey | ''>('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>('staff')
  const [inviteAccess, setInviteAccess] = useState('project')

  function openProjectDialog() {
    setProjectDialogMode('create')
    setProjectName('')
    setProjectClientLabel('')
    setProjectMarkIconKey('')
    setProjectMarkColorKey('')
    setProjectDialogOpen(true)
  }

  function openEditProjectDialog(project: Doc<'projects'>) {
    setProjectDialogMode('edit')
    setProjectName(project.name)
    setProjectClientLabel(project.clientLabel ?? '')
    setProjectMarkIconKey((project.markIconKey as EntityMarkIconKey | undefined) ?? '')
    setProjectMarkColorKey((project.markColorKey as EntityMarkColorKey | undefined) ?? '')
    setProjectDialogOpen(true)
  }

  function openGroupDialog() {
    setGroupDialogMode('create')
    setEditingGroupId(null)
    setGroupName('')
    setGroupMarkIconKey('')
    setGroupMarkColorKey('')
    setGroupDialogOpen(true)
  }

  function openEditGroupDialog(group: Doc<'groups'>) {
    setGroupDialogMode('edit')
    setEditingGroupId(group._id)
    setGroupName(group.name)
    setGroupMarkIconKey((group.markIconKey as EntityMarkIconKey | undefined) ?? '')
    setGroupMarkColorKey((group.markColorKey as EntityMarkColorKey | undefined) ?? '')
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
    projectMarkColorKey,
    projectMarkIconKey,
    groupMarkColorKey,
    groupMarkIconKey,
    setGroupDialogOpen,
    setGroupName,
    setInviteAccess,
    setInviteDialogOpen,
    setInviteEmail,
    setInviteRole,
    setProjectClientLabel,
    setProjectDialogOpen,
    setProjectName,
    setProjectMarkColorKey,
    setProjectMarkIconKey,
    setGroupMarkColorKey,
    setGroupMarkIconKey,
  }
}
