import { Navigate, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AtSign,
  Bell,
  Bot,
  Clock3,
  Download,
  FolderKanban,
  MessageSquarePlus,
  MessagesSquare,
  Paperclip,
  Plus,
  Search,
  Smile,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { FormEvent } from 'react'
import type { ReactNode } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { parseMentions } from '@track/shared'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { draftClassifications, draftStatuses, notificationModes } from '#/features/workspace/constants'
import { getActiveMention, getAvatarTone, getInitials, getMentionHandle } from '#/features/workspace/identity'
import { ProjectGroupGallery } from '#/features/workspace/project-group-gallery'
import { AssistantAnswer, DraftRecordCard, MessageRow, Metric } from '#/features/workspace/thread-items'
import { WorkspaceDialogs } from '#/features/workspace/workspace-dialogs'
import { authClient } from '#/lib/auth-client'

type WorkspacePageProps = {
  groupId?: string
  projectId?: string
  view?: 'home' | 'project' | 'group'
}

export function WorkspacePage({ groupId, projectId, view = 'home' }: WorkspacePageProps) {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser)
  const ensureStarterProject = useMutation(api.projects.ensureStarter)
  const createProject = useMutation(api.projects.create)
  const createGroup = useMutation(api.groups.create)
  const createInvitation = useMutation(api.invitations.create)
  const acceptPendingInvitations = useMutation(api.invitations.acceptPendingForCurrentUser)
  const updateGroupAiReviewSettings = useMutation(api.groups.updateAiReviewSettings)
  const sendMessageMutation = useMutation(api.messages.send)
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl)
  const attachFileMutation = useMutation(api.messages.attachFile)
  const runReviewAction = useAction(api.ai.runReviewNow)
  const classifyDraftMutation = useMutation(api.records.classifyDraft)
  const updateRecordStatus = useMutation(api.records.updateStatus)
  const askTrackAction = useAction(api.assistant.ask)
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode)
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode)
  const requestExport = useMutation(api.exports.request)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null)
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null)
  const [composer, setComposer] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const [composerCursor, setComposerCursor] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [frequencyDialogOpen, setFrequencyDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectClientLabel, setProjectClientLabel] = useState('')
  const [groupName, setGroupName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff' | 'client'>('staff')
  const [inviteCanReview, setInviteCanReview] = useState(true)
  const [inviteScope, setInviteScope] = useState<'project' | 'group'>('project')
  const [frequencyMinutesInput, setFrequencyMinutesInput] = useState('30')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const routeProjectId = projectId as Id<'projects'> | undefined
  const routeGroupId = groupId as Id<'groups'> | undefined

  const trackUser = useQuery(api.auth.getCurrentUser)
  const projects = useQuery(
    api.projects.list,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const groups = useQuery(
    api.groups.listVisible,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const projectMembers = useQuery(
    api.projects.listMembers,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && activeGroupId
      ? { userId: trackUserId, groupId: activeGroupId, limit: 80 }
      : 'skip',
  )
  const drafts = useQuery(
    api.records.listDrafts,
    trackUserId && activeProjectId && activeGroupId
      ? { userId: trackUserId, projectId: activeProjectId, groupId: activeGroupId }
      : 'skip',
  )
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const latestReview = useQuery(
    api.ai.latestForGroup,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId } : 'skip',
  )
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && activeGroupId
      ? { userId: trackUserId, groupId: activeGroupId, limit: 20 }
      : 'skip',
  )
  const notificationSettings = useQuery(
    api.notifications.getSettings,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const auditEvents = useQuery(
    api.audit.listProjectEvents,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId, limit: 30 }
      : 'skip',
  )
  const invitations = useQuery(
    api.invitations.listForProject,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const exports = useQuery(
    api.exports.list,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const exportDownloadUrl = useQuery(
    api.exports.getDownloadUrl,
    trackUserId && latestExportId ? { userId: trackUserId, exportId: latestExportId } : 'skip',
  )

  const projectItems = useMemo(
    () =>
      (projects ?? []) as Array<{
        project: Doc<'projects'>
        membership: Doc<'projectMembers'>
      }>,
    [projects],
  )
  const visibleGroups = useMemo(() => (groups ?? []) as Array<Doc<'groups'>>, [groups])
  const activeProjectMembers = useMemo(
    () =>
      (projectMembers ?? []) as Array<{
        membership: Doc<'projectMembers'>
        user: Doc<'users'> | null
      }>,
    [projectMembers],
  )
  const projectMemberRoleByUserId = useMemo(() => {
    const roles = new Map<string, Doc<'projectMembers'>['role']>()
    for (const item of activeProjectMembers) {
      if (item.user) roles.set(item.user._id, item.membership.role)
    }
    return roles
  }, [activeProjectMembers])
  const mentionOptions = useMemo(() => {
    const members = activeProjectMembers
      .filter((item) => item.user)
      .map((item) => {
        const user = item.user as Doc<'users'>
        return {
          id: user._id,
          kind: 'member' as const,
          label: user.displayName,
          sublabel: item.membership.role,
          handle: getMentionHandle(user.displayName) || getMentionHandle(user.email),
          tone: getAvatarTone(user.email),
        }
      })

    return [
      {
        id: 'track',
        kind: 'assistant' as const,
        label: 'Track Assistant',
        sublabel: 'ai review',
        handle: 'track',
        tone: 'bot',
      },
      ...members,
    ]
  }, [activeProjectMembers])
  const activeMention = useMemo(
    () => getActiveMention(composer, composerCursor),
    [composer, composerCursor],
  )
  const filteredMentionOptions = useMemo(() => {
    if (!activeMention) return []
    const query = activeMention.query
    return mentionOptions
      .filter(
        (option) =>
          option.handle.includes(query) ||
          option.label.toLowerCase().includes(query) ||
          option.sublabel.toLowerCase().includes(query),
      )
      .slice(0, 6)
  }, [activeMention, mentionOptions])
  const showMentionMenu = activeMention !== null && filteredMentionOptions.length > 0
  const groupMessages = useMemo(
    () =>
      (messages ?? []) as Array<{
        message: Doc<'messages'>
        author: Doc<'users'> | null
        authorRole: Doc<'projectMembers'>['role'] | null
        attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
      }>,
    [messages],
  )
  const groupDrafts = useMemo(() => (drafts ?? []) as Array<Doc<'draftRecords'>>, [drafts])
  const projectRecords = useMemo(() => (records ?? []) as Array<Doc<'records'>>, [records])
  const groupAssistantStreams = useMemo(
    () => (assistantStreams ?? []) as Array<Doc<'assistantStreams'>>,
    [assistantStreams],
  )
  const projectAuditEvents = useMemo(
    () => (auditEvents ?? []) as Array<Doc<'auditEvents'>>,
    [auditEvents],
  )
  const projectInvitations = useMemo(
    () => (invitations ?? []) as Array<Doc<'invitations'>>,
    [invitations],
  )
  const projectExports = useMemo(() => (exports ?? []) as Array<Doc<'exports'>>, [exports])
  const groupNotificationSettings = useMemo(
    () => (notificationSettings?.groups ?? []) as Array<Doc<'groupNotificationSettings'>>,
    [notificationSettings?.groups],
  )
  const latestCompletedExport =
    projectExports.find((exportJob) => exportJob.status === 'completed') ?? null

  useEffect(() => {
    setMentionIndex(0)
  }, [activeMention?.query])

  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) {
      setActiveProjectId(routeProjectId)
    }
  }, [activeProjectId, routeProjectId])

  useEffect(() => {
    if (routeGroupId && routeGroupId !== activeGroupId) {
      setActiveGroupId(routeGroupId)
    }
  }, [activeGroupId, routeGroupId])

  useEffect(() => {
    if (!session.data || trackUserId) return
    void ensureCurrentUser()
      .then(async (userId) => {
        setTrackUserId(userId)
        await acceptPendingInvitations({ userId })
      })
      .catch(setActionError)
  }, [acceptPendingInvitations, ensureCurrentUser, session.data, trackUserId])

  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) {
      setTrackUserId(trackUser._id)
    }
  }, [trackUser?._id, trackUserId])

  useEffect(() => {
    if (!trackUserId || projects === undefined || projectItems.length > 0) return
    void ensureStarterProject({ userId: trackUserId })
      .then((starterProjectId) => {
        setActiveProjectId(starterProjectId)
        void navigate({
          to: '/workspace/projects/$projectId',
          params: { projectId: starterProjectId },
        })
      })
      .catch(setActionError)
  }, [ensureStarterProject, navigate, projectItems.length, projects, trackUserId])

  useEffect(() => {
    if (!projectItems.length || activeProjectId) return
    const firstProjectId = projectItems[0]?.project._id ?? null
    setActiveProjectId(firstProjectId)
    if (view === 'home' && firstProjectId) {
      void navigate({
        to: '/workspace/projects/$projectId',
        params: { projectId: firstProjectId },
      })
    }
  }, [activeProjectId, navigate, projectItems, view])

  useEffect(() => {
    if (!visibleGroups.length) {
      setActiveGroupId(null)
      return
    }
    if (view !== 'group') {
      setActiveGroupId(null)
      return
    }
    if (!routeGroupId && (!activeGroupId || !visibleGroups.some((group) => group._id === activeGroupId))) {
      setActiveGroupId(visibleGroups[0]?._id ?? null)
    }
  }, [activeGroupId, routeGroupId, view, visibleGroups])

  useEffect(() => {
    if (!latestCompletedExport || latestExportId) return
    setLatestExportId(latestCompletedExport._id)
  }, [latestCompletedExport, latestExportId])

  const activeProject = projectItems.find((item) => item.project._id === activeProjectId)
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId)
  const visibleMessages = useMemo(() => [...groupMessages].reverse(), [groupMessages])
  const pendingDrafts = useMemo(
    () => groupDrafts.filter((draft) => draft.status === 'pending'),
    [groupDrafts],
  )
  const threadItems = useMemo(
    () =>
      [
        ...visibleMessages.map((item) => ({
          at: item.message.createdAt,
          item,
          kind: 'message' as const,
          key: item.message._id,
        })),
        ...groupAssistantStreams.map((stream) => ({
          at: stream.createdAt,
          stream,
          kind: 'assistant' as const,
          key: stream._id,
        })),
        ...pendingDrafts.map((draft) => ({
          at: draft.createdAt,
          draft,
          kind: 'draft' as const,
          key: draft._id,
        })),
      ].sort((a, b) => a.at - b.at),
    [groupAssistantStreams, pendingDrafts, visibleMessages],
  )
  const filteredThreadItems = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase()
    if (!query) return threadItems

    return threadItems.filter((threadItem) => {
      if (threadItem.kind === 'message') {
        return (
          threadItem.item.message.body.toLowerCase().includes(query) ||
          (threadItem.item.author?.displayName.toLowerCase().includes(query) ?? false)
        )
      }
      if (threadItem.kind === 'assistant') return threadItem.stream.answer.toLowerCase().includes(query)
      return (
        threadItem.draft.title.toLowerCase().includes(query) ||
        threadItem.draft.description.toLowerCase().includes(query)
      )
    })
  }, [chatSearchQuery, threadItems])
  const headerMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(0, 5),
    [activeProjectMembers],
  )
  const extraHeaderMemberCount = Math.max(activeProjectMembers.filter((item) => item.user).length - headerMembers.length, 0)
  const composerPeople = useMemo(
    () =>
      activeProjectMembers
        .filter((item) => item.user)
        .slice(0, 3)
        .map((item) => item.user?.displayName.split(' ')[0])
        .filter(Boolean),
    [activeProjectMembers],
  )
  const composerPlaceholder =
    composerPeople.length > 0
      ? `Write to the project - ${composerPeople.join(', ')}${activeProjectMembers.length > composerPeople.length ? ` and ${activeProjectMembers.length - composerPeople.length} others` : ''}`
      : `Message ${activeGroup?.name ?? 'the project'} or ask @track...`
  const messageCitations = useMemo(
    () =>
      new Map(
        visibleMessages.map((item) => [
          String(item.message._id),
          {
            author: item.author?.displayName ?? 'Unknown Member',
            createdAt: item.message.createdAt,
          },
        ]),
      ),
    [visibleMessages],
  )
  const groupNotificationMode =
    groupNotificationSettings.find((item) => item.groupId === activeGroupId)?.mode ?? 'inherit'
  const globalNotificationMode = notificationSettings?.global?.globalMode ?? 'mentions'

  if (session.isPending) return <TrackLoading label="Checking your session" />
  if (!session.data) return <Navigate to="/sign-in" />

  function setActionError(error: unknown) {
    setUiError(error instanceof Error ? error.message : 'Something went wrong')
  }

  async function withBusy(label: string, action: () => Promise<unknown>) {
    setBusyAction(label)
    setUiError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCreateProject() {
    setProjectName('')
    setProjectClientLabel('')
    setProjectDialogOpen(true)
  }

  async function handleCreateGroup() {
    setGroupName('')
    setGroupDialogOpen(true)
  }

  async function handleInvite() {
    setInviteEmail('')
    setInviteRole('staff')
    setInviteCanReview(true)
    setInviteScope(activeGroupId ? 'group' : 'project')
    setInviteDialogOpen(true)
  }

  function handleFrequencyChange() {
    const current = activeGroup?.aiReviewSettings?.frequencyMinutes ?? 30
    setFrequencyMinutesInput(String(current))
    setFrequencyDialogOpen(true)
  }

  async function handleCreateProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId) return
    const name = projectName.trim()
    if (!name) return
    await withBusy('create-project', async () => {
      const projectId = await createProject({
        userId: trackUserId,
        name,
        clientLabel: projectClientLabel.trim() || undefined,
      })
      setActiveProjectId(projectId)
      setActiveGroupId(null)
      setProjectDialogOpen(false)
    })
  }

  async function handleCreateGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId) return
    const name = groupName.trim()
    if (!name) return
    await withBusy('create-group', async () => {
      const groupId = await createGroup({
        userId: trackUserId,
        projectId: activeProjectId,
        name,
      })
      setActiveGroupId(groupId)
      setGroupDialogOpen(false)
      void navigate({
        to: '/workspace/projects/$projectId/groups/$groupId',
        params: { groupId, projectId: activeProjectId },
      })
    })
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId) return
    const email = inviteEmail.trim()
    if (!email) return

    await withBusy('invite', async () => {
      await createInvitation({
        projectId: activeProjectId,
        groupId: inviteScope === 'group' && activeGroupId ? activeGroupId : undefined,
        invitedBy: trackUserId,
        email,
        role: inviteRole,
        canReviewAiRecords: inviteCanReview,
      })
      setInviteDialogOpen(false)
    })
  }

  async function handleSendMessage() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    const body = composer.trim()
    if (!body) return
    setComposer('')
    setComposerCursor(0)
    await withBusy('send-message', async () => {
      const mentionHandles = parseMentions(body)
      const mentionedUserIds: Array<Id<'users'>> = []
      for (const handle of mentionHandles) {
        const option = mentionOptions.find((item) => item.kind === 'member' && item.handle === handle)
        if (option?.kind === 'member') mentionedUserIds.push(option.id)
      }
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body,
        mentions: mentionedUserIds,
      })
      if (mentionHandles.includes('track')) {
        await askTrackAction({
          projectId: activeProjectId,
          groupId: activeGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: body,
        })
      }
    })
  }

  function handleComposerSelection() {
    setComposerCursor(composerRef.current?.selectionStart ?? composer.length)
  }

  function handleMentionSelect(option: (typeof mentionOptions)[number]) {
    if (!activeMention) return
    const nextComposer = `${composer.slice(0, activeMention.start)}@${option.handle} ${composer.slice(activeMention.end)}`
    const nextCursor = activeMention.start + option.handle.length + 2
    setComposer(nextComposer)
    setComposerCursor(nextCursor)
    setMentionIndex(0)
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy('attach-file', async () => {
      const uploadUrl = await generateUploadUrl({
        groupId: activeGroupId,
        userId: trackUserId,
      })
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error('upload_failed')
      const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> }
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: composer.trim() || `Attached ${file.name}`,
        mentions: [],
      })
      await attachFileMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        messageId,
        userId: trackUserId,
        storageId,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })
      setComposer('')
    })
  }

  async function handleRunReview() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy('run-review', async () => {
      await runReviewAction({
        projectId: activeProjectId,
        groupId: activeGroupId,
        reviewerId: trackUserId,
      })
    })
  }

  async function handleFrequencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !activeProjectId || !activeGroupId || !activeGroup) return
    const frequencyMinutes = Number(frequencyMinutesInput)
    if (!Number.isFinite(frequencyMinutes)) {
      setUiError('Frequency must be a number.')
      return
    }
    await withBusy('review-frequency', async () => {
      await updateGroupAiReviewSettings({
        projectId: activeProjectId,
        groupId: activeGroupId,
        userId: trackUserId,
        enabled: activeGroup.aiReviewSettings?.enabled ?? true,
        frequencyMinutes,
      })
      setFrequencyDialogOpen(false)
    })
  }

  async function handleRecordStatus(
    recordId: Id<'records'>,
    status: 'open' | 'in_progress' | 'blocked' | 'done',
  ) {
    if (!trackUserId || !activeProjectId) return
    await withBusy(`record-status-${recordId}`, async () => {
      await updateRecordStatus({
        projectId: activeProjectId,
        recordId,
        actorId: trackUserId,
        status,
      })
    })
  }

  async function handleRequestExport(format: 'csv' | 'pdf') {
    if (!trackUserId || !activeProjectId) return
    await withBusy(`export-${format}`, async () => {
      const exportId = await requestExport({
        projectId: activeProjectId,
        userId: trackUserId,
        format,
        preset: format === 'pdf' ? 'full_audit_packet' : 'client_summary',
      })
      setLatestExportId(exportId)
    })
  }

  async function handleClassifyDraft(
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy(`classify-${draftRecordId}`, async () => {
      await classifyDraftMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        draftRecordId,
        reviewerId: trackUserId,
        classification,
        status: updates.status,
        title: updates.title,
        description: updates.description,
      })
    })
  }

  async function handleNotificationMode(mode: (typeof notificationModes)[number]) {
    if (!trackUserId) return
    await withBusy('notifications', async () => {
      if (mode === 'inherit') {
        if (!activeGroupId) return
        await setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode })
        return
      }
      if (activeGroupId) {
        await setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode })
      } else {
        await setGlobalNotificationMode({ userId: trackUserId, mode })
      }
    })
  }

  function navigateToProject(projectIdToOpen: Id<'projects'>) {
    setActiveProjectId(projectIdToOpen)
    setActiveGroupId(null)
    void navigate({
      to: '/workspace/projects/$projectId',
      params: { projectId: projectIdToOpen },
    })
  }

  function navigateToGroup(groupIdToOpen: Id<'groups'>) {
    if (!activeProjectId) return
    setActiveGroupId(groupIdToOpen)
    void navigate({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId: groupIdToOpen, projectId: activeProjectId },
    })
  }

  return (
    <main className="track-app-shell">
      <aside className="track-nav">
        <div className="track-brand">
          <img
            alt=""
            className="track-brand-mark"
            height={24}
            src="/track-mark.svg"
            width={35}
          />
          <span className="track-brand-word">Track</span>
        </div>

        <NavSection
          actionLabel="Create project"
          icon={<Plus size={13} />}
          label="Projects"
          onAction={handleCreateProject}
        />
        <div className="track-nav-list">
          {projectItems.map((item) => (
            <Button
              className={item.project._id === activeProjectId ? 'track-nav-item active' : 'track-nav-item'}
              key={item.project._id}
              onClick={() => navigateToProject(item.project._id)}
              type="button"
            >
              <FolderKanban className="track-nav-icon" size={14} />
              <span className="track-nav-copy">
                <span className="track-nav-title">{item.project.name}</span>
                <span className="track-nav-meta">{item.project.clientLabel ?? 'No client label'}</span>
              </span>
              <span className="track-nav-count">{item.membership.role}</span>
            </Button>
          ))}
        </div>

        {activeProjectId ? (
          <Button
            className="track-nav-item"
            onClick={() => navigateToProject(activeProjectId)}
            type="button"
          >
            <MessagesSquare className="track-nav-icon" size={14} />
            <span className="track-nav-copy">
              <span className="track-nav-title">Groups</span>
              <span className="track-nav-meta">Open group gallery</span>
            </span>
            <span className="track-nav-count">{visibleGroups.length}</span>
          </Button>
        ) : null}

        <div className="track-nav-footer">
          <Avatar className={`track-avatar ${getAvatarTone(trackUser?.email ?? trackUser?.displayName ?? 'Track User')}`}>
            <AvatarFallback>{getInitials(trackUser?.displayName ?? 'Track User')}</AvatarFallback>
          </Avatar>
          <div className="track-nav-copy">
            <span className="track-nav-title">{trackUser?.displayName ?? 'Track User'}</span>
            <span className="track-nav-meta">{activeProject?.membership.role ?? 'owner'}</span>
          </div>
        </div>
      </aside>

      <section className="track-workspace">
        <header className="track-thread-header">
          <div className="track-header-title">
            <h1>
              {view === 'group' && activeGroup
                ? `${activeGroup.name} Conversation`
                : activeProject
                  ? `${activeProject.project.name} Groups`
                  : 'Select a Project'}
              {activeProject?.project.clientLabel ? (
                <span className="track-header-status">{activeProject.project.clientLabel} · Active</span>
              ) : null}
            </h1>
          </div>
          <div className="track-header-actions">
            <div className="track-header-members" aria-label="Project members">
              {headerMembers.map((item) => {
                const user = item.user as Doc<'users'>
                return (
                  <Avatar className={`track-avatar ${getAvatarTone(user.email)}`} key={user._id}>
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                )
              })}
              {extraHeaderMemberCount > 0 ? (
                <span className="track-member-more">+{extraHeaderMemberCount}</span>
              ) : null}
            </div>
            {view === 'group' && searchOpen ? (
                <Input
                  autoFocus
                  className="track-chat-search"
                  onChange={(event) => setChatSearchQuery(event.currentTarget.value)}
                  placeholder="Search chat..."
                  value={chatSearchQuery}
                />
              ) : null}
            {view === 'group' ? (
              <>
                <Button
                  aria-label="Search chat"
                  className="icon-button"
                  onClick={() => {
                    setSearchOpen((open) => !open)
                    if (searchOpen) setChatSearchQuery('')
                  }}
                  type="button"
                >
                  <Search size={15} />
                </Button>
                <Input
                  className="track-file-input"
                  onChange={(event) => void handleFileSelected(event)}
                  ref={fileInputRef}
                  type="file"
                />
              </>
            ) : null}
            <Button
              className="track-button"
              disabled={!activeProjectId || busyAction === 'invite'}
              onClick={handleInvite}
              type="button"
            >
              Invite
            </Button>
            {view === 'group' ? (
              <Button
                className="track-button track-button-accent"
                disabled={!activeGroupId || busyAction === 'run-review'}
                onClick={handleRunReview}
                type="button"
              >
                <Sparkles size={14} />
                Run AI Review
              </Button>
            ) : (
              <Button
                className="track-button track-button-accent"
                disabled={!activeProjectId || busyAction === 'create-group'}
                onClick={handleCreateGroup}
                type="button"
              >
                <MessageSquarePlus size={14} />
                New Group
              </Button>
            )}
          </div>
        </header>

        {uiError ? <div className="track-error">{uiError}</div> : null}

        {view === 'group' ? (
          <>
            <div className="track-thread-scroll">
              <div className="track-thread">
                {activeGroup && visibleMessages.length === 0 ? (
                  <div className="track-empty">
                    <p className="mono-label m-0">Empty Group</p>
                    <p>Only members of {activeGroup.name} can see this conversation. Send the first message to start the record.</p>
                  </div>
                ) : null}

                {chatSearchQuery.trim() && filteredThreadItems.length === 0 ? (
                  <div className="track-empty">
                    <p className="mono-label m-0">No matches</p>
                    <p>No chat items match "{chatSearchQuery.trim()}".</p>
                  </div>
                ) : null}

                {filteredThreadItems.map((threadItem) => {
                  if (threadItem.kind === 'message') {
                    return (
                      <MessageRow
                        authorRole={
                          projectMemberRoleByUserId.get(threadItem.item.author?._id ?? '') ??
                          threadItem.item.authorRole
                        }
                        key={threadItem.key}
                        item={threadItem.item}
                      />
                    )
                  }
                  if (threadItem.kind === 'assistant') {
                    return (
                      <AssistantAnswer
                        key={threadItem.key}
                        messageCitations={messageCitations}
                        stream={threadItem.stream}
                      />
                    )
                  }
                  return (
                    <DraftRecordCard
                      busy={busyAction === `classify-${threadItem.draft._id}`}
                      draft={threadItem.draft}
                      key={threadItem.key}
                      onClassify={handleClassifyDraft}
                    />
                  )
                })}
              </div>
            </div>

            <div className="track-composer-wrap">
              <div className="track-composer">
                <Textarea
                  aria-label={`Message ${activeGroup?.name ?? 'Group'}`}
                  disabled={!activeGroupId || busyAction === 'send-message'}
                  onBlur={handleComposerSelection}
                  onChange={(event) => {
                    setComposer(event.currentTarget.value)
                    setComposerCursor(event.currentTarget.selectionStart)
                  }}
                  onKeyDown={(event) => {
                    if (showMentionMenu) {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setMentionIndex((index) => (index + 1) % filteredMentionOptions.length)
                        return
                      }
                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setMentionIndex((index) => (index - 1 + filteredMentionOptions.length) % filteredMentionOptions.length)
                        return
                      }
                      if (event.key === 'Enter' || event.key === 'Tab') {
                        event.preventDefault()
                        const option = filteredMentionOptions[mentionIndex] ?? filteredMentionOptions[0]
                        if (option) handleMentionSelect(option)
                        return
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setComposerCursor(0)
                        return
                      }
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void handleSendMessage()
                    }
                  }}
                  onKeyUp={handleComposerSelection}
                  onSelect={handleComposerSelection}
                  placeholder={composerPlaceholder}
                  ref={composerRef}
                  value={composer}
                />
                {showMentionMenu ? (
                  <div className="track-mention-menu" role="listbox" aria-label="Mention someone">
                    {filteredMentionOptions.map((option, index) => (
                      <button
                        aria-selected={index === mentionIndex}
                        className={index === mentionIndex ? 'track-mention-option active' : 'track-mention-option'}
                        key={option.id}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          handleMentionSelect(option)
                        }}
                        role="option"
                        type="button"
                      >
                        <Avatar className={option.tone === 'bot' ? 'track-mention-avatar bot' : `track-mention-avatar ${option.tone}`}>
                          <AvatarFallback>{option.kind === 'assistant' ? <Bot size={13} /> : getInitials(option.label)}</AvatarFallback>
                        </Avatar>
                        <span>
                          <strong>@{option.handle}</strong>
                          <small>{option.label} · {option.sublabel}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="track-composer-bar">
                  <Button
                    className="icon-button"
                    disabled={!activeGroupId || busyAction === 'attach-file'}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach evidence"
                    type="button"
                  >
                    <Paperclip size={15} />
                  </Button>
                  <Button
                    className="icon-button"
                    disabled={!activeGroupId || busyAction === 'send-message'}
                    onClick={() => {
                      const cursor = composerRef.current?.selectionStart ?? composer.length
                      const spacer = cursor > 0 && !/\s$/.test(composer.slice(0, cursor)) ? ' @' : '@'
                      const nextComposer = `${composer.slice(0, cursor)}${spacer}${composer.slice(cursor)}`
                      const nextCursor = cursor + spacer.length
                      setComposer(nextComposer)
                      setComposerCursor(nextCursor)
                      requestAnimationFrame(() => {
                        composerRef.current?.focus()
                        composerRef.current?.setSelectionRange(nextCursor, nextCursor)
                      })
                    }}
                    title="Mention"
                    type="button"
                  >
                    <AtSign size={15} />
                  </Button>
                  <Button className="icon-button" disabled={!activeGroupId} title="Reaction" type="button">
                    <Smile size={15} />
                  </Button>
                  <span className="track-composer-hint">
                    <Sparkles size={12} />
                    AI auto-review on
                  </span>
                  <Button
                    className="track-button track-button-primary"
                    disabled={!composer.trim() || !activeGroupId || busyAction === 'send-message'}
                    onClick={handleSendMessage}
                    type="button"
                  >
                    Send
                    <span className="track-send-key">↵</span>
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <ProjectGroupGallery groups={visibleGroups} onOpenGroup={navigateToGroup} />
        )}
      </section>

      <aside className="track-rail">
        <Card className="track-rail-section" size="sm">
          <div className="track-rail-title">
            <span>
              <span className="track-rail-heading">AI Review</span>
              <span className="track-rail-sub">current Group</span>
            </span>
            <span className="track-pulse" />
          </div>
          <div className="track-review-status">
            <span>Last run</span>
            <strong>{latestReview?.finishedAt ? new Date(latestReview.finishedAt).toLocaleTimeString() : 'Never'}</strong>
          </div>
          <Button
            className="track-setting-button"
            disabled={!activeGroupId || busyAction === 'review-frequency'}
            onClick={handleFrequencyChange}
            type="button"
          >
            Every {activeGroup?.aiReviewSettings?.frequencyMinutes ?? 30} minutes
          </Button>
          <p className="track-muted">{latestReview?.summary ?? 'Run AI Review to propose Draft Records from this Group.'}</p>
        </Card>

        <Card className="track-count-grid" size="sm">
          <Metric label="Drafts" value={pendingDrafts.length} />
          <Metric label="Records" value={records?.length ?? 0} />
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
            <span className="track-rail-heading">Notifications</span>
            <Bell size={14} />
          </div>
          <p className="track-muted">Global: {globalNotificationMode}. Group: {groupNotificationMode}.</p>
          <ToggleGroup
            className="track-mode-grid"
            value={[groupNotificationMode]}
            onValueChange={(value) => {
              const mode = value.at(-1) as (typeof notificationModes)[number] | undefined
              if (mode) void handleNotificationMode(mode)
            }}
          >
            {notificationModes.map((mode) => (
              <ToggleGroupItem
                className={mode === groupNotificationMode ? 'track-chip active' : 'track-chip'}
                key={mode}
                value={mode}
              >
                {mode}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Card>

        <Card className="track-rail-section" size="sm">
          <div className="track-rail-heading-row">
            <span className="track-rail-heading">Project Record</span>
            <Button
              className="icon-button"
              disabled={!activeProjectId || busyAction === 'export-pdf'}
              onClick={() => void handleRequestExport('pdf')}
              title="Generate audit PDF"
              type="button"
            >
              <Download size={14} />
            </Button>
          </div>
          <div className="track-export-row">
            <Button
              className="track-chip"
              disabled={!activeProjectId || busyAction === 'export-csv'}
              onClick={() => void handleRequestExport('csv')}
              type="button"
            >
              CSV
            </Button>
            <Button
              className="track-chip"
              disabled={!activeProjectId || busyAction === 'export-pdf'}
              onClick={() => void handleRequestExport('pdf')}
              type="button"
            >
              PDF
            </Button>
            {exportDownloadUrl ? (
              <a className="track-export-link" href={exportDownloadUrl} rel="noreferrer" target="_blank">
                Download latest
              </a>
            ) : latestExportId ? (
              <span className="track-muted">Preparing export...</span>
            ) : null}
          </div>
          <div className="track-record-list">
            {projectRecords.slice(0, 8).map((record) => (
              <Card className="track-record-item" key={record._id} size="sm">
                <div>
                  <span className="track-record-id">{record._id.slice(-6)}</span>
                  <Badge className={record.classification === 'billable_scope' ? 'track-badge success' : 'track-badge'} variant="outline">
                    {record.classification}
                  </Badge>
                </div>
                <strong>{record.title}</strong>
                <p>{record.type} · {record.status}</p>
                <div className="track-record-actions">
                  {(['open', 'in_progress', 'blocked', 'done'] as const).map((status) => (
                    <Button
                      className={record.status === status ? 'track-mini-button active' : 'track-mini-button'}
                      disabled={busyAction === `record-status-${record._id}`}
                      key={status}
                      onClick={() => void handleRecordStatus(record._id, status)}
                      type="button"
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </Card>
            ))}
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
      <WorkspaceDialogs
        activeGroupId={activeGroupId}
        activeGroupName={activeGroup?.name}
        busyAction={busyAction}
        frequencyDialogOpen={frequencyDialogOpen}
        frequencyMinutesInput={frequencyMinutesInput}
        groupDialogOpen={groupDialogOpen}
        groupName={groupName}
        inviteCanReview={inviteCanReview}
        inviteDialogOpen={inviteDialogOpen}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteScope={inviteScope}
        onCreateGroupSubmit={handleCreateGroupSubmit}
        onCreateProjectSubmit={handleCreateProjectSubmit}
        onFrequencySubmit={handleFrequencySubmit}
        onInviteSubmit={handleInviteSubmit}
        projectClientLabel={projectClientLabel}
        projectDialogOpen={projectDialogOpen}
        projectName={projectName}
        setFrequencyDialogOpen={setFrequencyDialogOpen}
        setFrequencyMinutesInput={setFrequencyMinutesInput}
        setGroupDialogOpen={setGroupDialogOpen}
        setGroupName={setGroupName}
        setInviteCanReview={setInviteCanReview}
        setInviteDialogOpen={setInviteDialogOpen}
        setInviteEmail={setInviteEmail}
        setInviteRole={setInviteRole}
        setInviteScope={setInviteScope}
        setProjectClientLabel={setProjectClientLabel}
        setProjectDialogOpen={setProjectDialogOpen}
        setProjectName={setProjectName}
      />
    </main>
  )
}

function TrackLoading({ label }: { label: string }) {
  return (
    <main className="track-loading">
      <div className="track-surface rounded-md p-4 text-center">
        <p className="mono-label m-0">Track Access</p>
        <p className="m-0 mt-2 text-sm text-[var(--ink-3)]">{label}...</p>
      </div>
    </main>
  )
}

function NavSection({
  actionLabel,
  icon,
  label,
  onAction,
}: {
  actionLabel: string
  icon: ReactNode
  label: string
  onAction: () => void
}) {
  return (
    <div className="track-nav-section">
      <span>{label}</span>
      <Button aria-label={actionLabel} className="track-nav-action" onClick={onAction} type="button">
        {icon}
      </Button>
    </div>
  )
}
