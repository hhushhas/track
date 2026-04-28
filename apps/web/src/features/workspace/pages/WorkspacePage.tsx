import { Navigate, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AtSign,
  Bell,
  Bot,
  ChevronDown,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FolderKanban,
  GripVertical,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquarePlus,
  MessagesSquare,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Search,
  Settings2,
  Smile,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent } from 'react'
import type { CSSProperties } from 'react'
import type { FormEvent } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { parseMentions } from '@track/shared'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
} from '#/components/ui/card'
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
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { draftClassifications, draftStatuses, notificationModes } from '#/features/workspace/constants'
import { getGroupAvatar } from '#/features/workspace/group-avatar'
import { getActiveMention, getAvatarTone, getInitials, getMentionHandle } from '#/features/workspace/identity'
import { AssistantAnswer, DraftRecordCard, MessageRow, Metric } from '#/features/workspace/thread-items'
import {
  getNotificationPermission,
  notificationPermissionLabels,
  requestNotificationPermission,
  serializePushSubscription,
  shouldNotifyForIncomingMessage,
  showMessageNotification,
  subscribeToWebPush,
  type WebNotificationPermission,
} from '#/features/workspace/web-notifications'
import { WorkspaceDialogs } from '#/features/workspace/workspace-dialogs'
import { authClient } from '#/lib/auth-client'
import ThemeToggle from '#/components/ThemeToggle'

type WorkspacePageProps = {
  groupId?: string
  projectId?: string
  view?: 'home' | 'project' | 'group' | 'records' | 'settings'
}

function getSessionUser(sessionData: unknown) {
  if (!sessionData || typeof sessionData !== 'object') return null

  const data = sessionData as {
    user?: {
      id?: string | null
      email?: string | null
      name?: string | null
    } | null
    session?: {
      userId?: string | null
    } | null
    id?: string | null
    email?: string | null
    name?: string | null
  }
  const user = data.user ?? data
  const id = user.id ?? data.session?.userId

  if (!id) return null

  return {
    id,
    email: user.email ?? '',
    name: user.name ?? user.email?.split('@')[0] ?? 'Track User',
  }
}

const emojiGroups = [
  {
    label: 'Recent',
    emojis: ['👍', '✅', '🔥', '🙏', '👀', '🚀', '💬', '📌', '🎯', '⚠️', '💡', '📝'],
  },
  {
    label: 'Work',
    emojis: ['📣', '📎', '📄', '📊', '📈', '🧾', '🗓️', '⏱️', '🔍', '🔐', '🛠️', '🏁'],
  },
  {
    label: 'Tone',
    emojis: ['😀', '😅', '😂', '😊', '🤝', '🙌', '👏', '💪', '🤔', '😬', '😎', '✨'],
  },
] as const

function createPendingAttachment(file: File) {
  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatRailLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export function WorkspacePage({ groupId, projectId, view = 'home' }: WorkspacePageProps) {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const syncCurrentUser = useMutation(api.auth.syncGoogleUser)
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
  const sendTestPushAction = useAction(api.pushNotifications.sendTestNotification)
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode)
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode)
  const registerNotificationSubscription = useMutation(api.notifications.registerSubscription)
  const requestExport = useMutation(api.exports.request)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null)
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null)
  const [composer, setComposer] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<Array<ReturnType<typeof createPendingAttachment>>>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const [composerCursor, setComposerCursor] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [recordSearchQuery, setRecordSearchQuery] = useState('')
  const [recordFilter, setRecordFilter] = useState<'all' | 'open' | 'billable' | 'blocked' | 'done'>('all')
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
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [railWidth, setRailWidth] = useState(312)
  const [railResizing, setRailResizing] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<WebNotificationPermission>(getNotificationPermission)
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingAttachmentsRef = useRef<Array<ReturnType<typeof createPendingAttachment>>>([])
  const hydratedNotificationMessagesRef = useRef(false)
  const notifiedMessageIdsRef = useRef(new Set<string>())
  const registeredPushUserRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      for (const attachment of pendingAttachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])
  const routeProjectId = projectId as Id<'projects'> | undefined
  const routeGroupId = groupId as Id<'groups'> | undefined
  const sessionUser = useMemo(() => getSessionUser(session.data), [session.data])

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
  const webPushPublicKey = useQuery(api.notifications.getWebPushPublicKey)
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
  const filteredProjectRecords = useMemo(() => {
    const query = recordSearchQuery.trim().toLowerCase()
    return projectRecords.filter((record) => {
      const matchesFilter =
        recordFilter === 'all' ||
        (recordFilter === 'open' &&
          (record.status === 'open' || record.status === 'in_progress')) ||
        (recordFilter === 'billable' && record.classification === 'billable_scope') ||
        (recordFilter === 'blocked' && record.status === 'blocked') ||
        (recordFilter === 'done' && record.status === 'done')
      if (!matchesFilter) return false
      if (!query) return true
      return [
        record.title,
        record.description,
        record.type,
        record.classification,
        record.status,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [projectRecords, recordFilter, recordSearchQuery])
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
    if (!railResizing) return
    function handlePointerMove(event: PointerEvent) {
      setRailWidth(Math.min(460, Math.max(280, window.innerWidth - event.clientX)))
    }
    function handlePointerUp() {
      setRailResizing(false)
    }
    document.body.classList.add('track-rail-resizing')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      document.body.classList.remove('track-rail-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [railResizing])

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
    if (!sessionUser?.id || trackUserId) return
    void syncCurrentUser({
      googleSubject: sessionUser.id,
      email: sessionUser.email,
      displayName: sessionUser.name,
    })
      .then(async (userId) => {
        setTrackUserId(userId)
        await acceptPendingInvitations({ userId })
      })
      .catch(setActionError)
  }, [acceptPendingInvitations, sessionUser?.email, sessionUser?.id, sessionUser?.name, syncCurrentUser, trackUserId])

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
    if (view !== 'group') {
      setActiveGroupId(null)
      return
    }
    if (routeGroupId) {
      if (activeGroupId !== routeGroupId) {
        setActiveGroupId(routeGroupId)
      }
      if (groups !== undefined && !visibleGroups.some((group) => group._id === routeGroupId)) {
        setUiError('This group is not visible in the selected project.')
      }
      return
    }
    if (groups === undefined) return
    if (!visibleGroups.length) {
      setActiveGroupId(null)
      return
    }
    if (!routeGroupId && (!activeGroupId || !visibleGroups.some((group) => group._id === activeGroupId))) {
      setActiveGroupId(visibleGroups[0]?._id ?? null)
    }
  }, [activeGroupId, groups, routeGroupId, view, visibleGroups])

  useEffect(() => {
    const firstGroupId = visibleGroups[0]?._id
    if (view !== 'project' || groups === undefined || !activeProjectId || !firstGroupId) return
    void navigate({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId: firstGroupId, projectId: activeProjectId },
    })
  }, [activeProjectId, groups, navigate, view, visibleGroups])

  useEffect(() => {
    if (!latestCompletedExport || latestExportId) return
    setLatestExportId(latestCompletedExport._id)
  }, [latestCompletedExport, latestExportId])

  const activeProject = projectItems.find((item) => item.project._id === activeProjectId)
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId)
  const currentUserName = sessionUser?.name ?? 'Track User'
  const currentUserEmail = sessionUser?.email || currentUserName
  const isProjectRouteLoading =
    trackUserId !== null &&
    (projects === undefined ||
      (activeProjectId !== null && (groups === undefined || projectMembers === undefined)))
  const isGroupRouteLoading =
    view === 'group' &&
    activeGroupId !== null &&
    (groups === undefined || messages === undefined || drafts === undefined || activeGroup === undefined)
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

  useEffect(() => {
    hydratedNotificationMessagesRef.current = false
    notifiedMessageIdsRef.current.clear()
  }, [activeGroupId])

  useEffect(() => {
    setNotificationPermission(getNotificationPermission())
  }, [])

  useEffect(() => {
    if (notificationPermission !== 'granted' || !trackUserId || !webPushPublicKey) return
    if (registeredPushUserRef.current === trackUserId) return
    registeredPushUserRef.current = trackUserId
    void registerBrowserPushSubscription().catch((error) => {
      registeredPushUserRef.current = null
      setActionError(error)
    })
  }, [notificationPermission, trackUserId, webPushPublicKey])

  useEffect(() => {
    if (!activeGroup || !activeProject || !activeGroupId || !trackUserId || messages === undefined) return
    if (notificationPermission !== 'granted') return

    if (!hydratedNotificationMessagesRef.current) {
      for (const item of visibleMessages) {
        notifiedMessageIdsRef.current.add(item.message._id)
      }
      hydratedNotificationMessagesRef.current = true
      return
    }

    const latestMessage = visibleMessages.at(-1)
    if (!latestMessage || notifiedMessageIdsRef.current.has(latestMessage.message._id)) return
    notifiedMessageIdsRef.current.add(latestMessage.message._id)

    if (
      !shouldNotifyForIncomingMessage({
        authorId: latestMessage.message.authorId,
        currentUserId: trackUserId,
        globalMode: globalNotificationMode,
        groupMode: groupNotificationMode,
        mentions: latestMessage.message.mentions,
      })
    ) {
      return
    }

    void showMessageNotification({
      title: `${latestMessage.author?.displayName ?? 'New message'} in ${activeGroup.name}`,
      body: latestMessage.message.body.slice(0, 160),
      tag: `track-message-${latestMessage.message._id}`,
      url: window.location.pathname,
    }).catch(setActionError)
  }, [
    activeGroup,
    activeGroupId,
    activeProject,
    globalNotificationMode,
    groupNotificationMode,
    messages,
    notificationPermission,
    trackUserId,
    visibleMessages,
  ])

  if (session.isPending) return <TrackLoading label="Checking your session" />
  if (!session.data) return <Navigate to="/sign-in" />
  if (!sessionUser) return <Navigate to="/sign-in" />
  if (!trackUserId && uiError) return <TrackLoading label={uiError} />
  if (!trackUserId) return <TrackLoading label="Connecting your project session" />

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
    if (!body && pendingAttachments.length === 0) return
    await withBusy('send-message', async () => {
      const mentionHandles = parseMentions(body)
      const mentionedUserIds: Array<Id<'users'>> = []
      for (const handle of mentionHandles) {
        const option = mentionOptions.find((item) => item.kind === 'member' && item.handle === handle)
        if (option?.kind === 'member') mentionedUserIds.push(option.id)
      }
      const attachmentBody =
        body ||
        `Attached ${pendingAttachments.map((attachment) => attachment.file.name).join(', ')}`
      const uploadedAttachments = await Promise.all(pendingAttachments.map(async (pendingAttachment) => {
        const uploadUrl = await generateUploadUrl({
          groupId: activeGroupId,
          userId: trackUserId,
        })
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': pendingAttachment.file.type || 'application/octet-stream' },
          body: pendingAttachment.file,
        })
        if (!uploadResponse.ok) throw new Error('upload_failed')
        const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> }
        return {
          contentType: pendingAttachment.file.type || 'application/octet-stream',
          filename: pendingAttachment.file.name,
          size: pendingAttachment.file.size,
          storageId,
        }
      }))
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: attachmentBody,
        mentions: mentionedUserIds,
      })
      for (const attachment of uploadedAttachments) {
        await attachFileMutation({
          projectId: activeProjectId,
          groupId: activeGroupId,
          messageId,
          userId: trackUserId,
          storageId: attachment.storageId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
        })
      }
      if (mentionHandles.includes('track')) {
        await askTrackAction({
          projectId: activeProjectId,
          groupId: activeGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: attachmentBody,
        })
      }
      setComposer('')
      setComposerCursor(0)
      clearPendingAttachments()
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

  function insertComposerText(text: string) {
    const cursor = composerRef.current?.selectionStart ?? composerCursor
    const nextComposer = `${composer.slice(0, cursor)}${text}${composer.slice(cursor)}`
    const nextCursor = cursor + text.length
    setComposer(nextComposer)
    setComposerCursor(nextCursor)
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0 || !activeGroupId) return
    addPendingAttachments(files)
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!activeGroupId) return
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    addPendingAttachments(files)
  }

  function addPendingAttachments(files: Array<File>) {
    setPendingAttachments((attachments) => [...attachments, ...files.map(createPendingAttachment)])
    setEmojiPickerOpen(false)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((attachments) => {
      const attachment = attachments.find((item) => item.id === id)
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      return attachments.filter((item) => item.id !== id)
    })
  }

  function clearPendingAttachments() {
    setPendingAttachments((attachments) => {
      for (const attachment of attachments) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      }
      return []
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

  async function handleEnableBrowserNotifications() {
    if (!trackUserId) return
    setNotificationStatus(null)
    await withBusy('notifications', async () => {
      const permission = await requestNotificationPermission()
      setNotificationPermission(permission)
      if (permission === 'denied') {
        throw new Error('Browser notifications are blocked for Track.')
      }
      if (permission === 'unsupported') {
        throw new Error('This browser does not support web notifications.')
      }
      if (permission === 'granted') {
        await registerBrowserPushSubscription({ forceRefresh: true })
        await showMessageNotification({
          title: 'Track notifications enabled',
          body: 'You will get alerts for new project messages.',
          tag: 'track-notifications-enabled',
          url: window.location.pathname,
        })
        setNotificationStatus('Browser alerts reconnected.')
      }
    })
  }

  async function handleSendTestNotification() {
    if (!trackUserId) return
    setNotificationStatus(null)
    await withBusy('test-notifications', async () => {
      let permission = getNotificationPermission()
      if (permission === 'default') {
        permission = await requestNotificationPermission()
        setNotificationPermission(permission as WebNotificationPermission)
      }
      if (permission !== 'granted') {
        throw new Error(permission === 'denied' ? 'Browser notifications are blocked for Track.' : 'Browser notifications are not enabled.')
      }

      await registerBrowserPushSubscription({ forceRefresh: true })
      const result = await sendTestPushAction({ userId: trackUserId })
      if (result.attempted === 0) {
        throw new Error('No browser push subscription was saved yet. Try reconnecting alerts and keep this tab open for a moment.')
      }
      if (result.sent === 0) {
        throw new Error('Track found your browser subscription, but the push service rejected the test alert.')
      }
      setNotificationStatus(`Test alert sent to ${result.sent} browser${result.sent === 1 ? '' : 's'}.`)
    })
  }

  async function registerBrowserPushSubscription(options: { forceRefresh?: boolean } = {}) {
    if (!trackUserId) return
    if (!webPushPublicKey) {
      throw new Error('Web push is not configured for this environment.')
    }
    const subscription = await subscribeToWebPush(webPushPublicKey, options)
    await registerNotificationSubscription({
      userId: trackUserId,
      platform: 'web',
      ...serializePushSubscription(subscription),
    })
  }

  function navigateToProject(projectIdToOpen: Id<'projects'>) {
    setMobileNavOpen(false)
    setActiveProjectId(projectIdToOpen)
    setActiveGroupId(null)
    void navigate({
      to: '/workspace/projects/$projectId',
      params: { projectId: projectIdToOpen },
    })
  }

  function navigateToGroup(groupIdToOpen: Id<'groups'>) {
    if (!activeProjectId) return
    setMobileNavOpen(false)
    setActiveGroupId(groupIdToOpen)
    void navigate({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId: groupIdToOpen, projectId: activeProjectId },
    })
  }

  function navigateToProjectRecords() {
    if (!activeProjectId) return
    setMobileNavOpen(false)
    setActiveGroupId(null)
    void navigate({
      to: '/workspace/projects/$projectId/records',
      params: { projectId: activeProjectId },
    })
  }

  function navigateToProjectSettings() {
    if (!activeProjectId) return
    setMobileNavOpen(false)
    setActiveGroupId(null)
    void navigate({
      to: '/workspace/projects/$projectId/settings',
      params: { projectId: activeProjectId },
    })
  }

  async function handleSignOut() {
    await authClient.signOut()
    await navigate({ to: '/sign-in' })
  }

  return (
    <main
      className={[
        'track-app-shell',
        view === 'group' ? 'track-app-shell-with-rail' : '',
        railCollapsed ? 'track-app-shell-rail-collapsed' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--track-rail-width': `${railWidth}px` } as CSSProperties}
    >
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="track-mobile-nav-scrim"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={mobileNavOpen ? 'track-nav mobile-open' : 'track-nav'}>
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

        <div className="track-current-project">
          <span className="track-nav-section-label">Project</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="track-current-project-card"
              disabled={!projectItems.length}
            >
              <FolderKanban className="track-nav-icon" size={14} />
              <span className="track-nav-copy">
                <span className="track-nav-title">{activeProject?.project.name ?? 'Select a project'}</span>
                <span className="track-nav-meta">{activeProject?.project.clientLabel ?? 'No client label'}</span>
              </span>
              <ChevronDown className="track-nav-icon" size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="track-project-switcher-menu" side="right" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch project</DropdownMenuLabel>
                {projectItems.map((item) => (
                  <DropdownMenuItem
                    className={item.project._id === activeProjectId ? 'track-project-switcher-item active' : 'track-project-switcher-item'}
                    key={item.project._id}
                    onClick={() => navigateToProject(item.project._id)}
                  >
                    <span className="track-menu-project-name">{item.project.name}</span>
                    <span className="track-menu-project-role">{item.membership.role}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="track-project-switcher-create" onClick={handleCreateProject}>
                <Plus size={13} />
                Create project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {activeProjectId ? (
          <div className="track-nav-secondary">
            <div className="track-sidebar-groups">
              <div className="track-nav-section no-action">
                <span>Groups</span>
              </div>
              <div className="track-nav-list">
                {visibleGroups.map((group) => (
                  (() => {
                    const { Icon, tone } = getGroupAvatar(group)
                    return (
                      <Button
                        className={group._id === activeGroupId ? 'track-nav-item compact active' : 'track-nav-item compact'}
                        key={group._id}
                        onClick={() => navigateToGroup(group._id)}
                        type="button"
                      >
                        <span className={`track-nav-group-icon ${tone}`}>
                          <Icon size={14} strokeWidth={2.1} />
                        </span>
                        <span className="track-nav-copy">
                          <span className="track-nav-title">{group.name}</span>
                        </span>
                      </Button>
                    )
                  })()
                ))}
                {visibleGroups.length === 0 ? (
                  <span className="track-nav-empty">No groups yet</span>
                ) : null}
              </div>
            </div>

            <div className="track-sidebar-tools">
              <div className="track-nav-section no-action">
                <span>Project</span>
              </div>
              <Button
                className={view === 'records' ? 'track-nav-item active' : 'track-nav-item'}
                onClick={navigateToProjectRecords}
                type="button"
              >
                <FileCheck2 className="track-nav-icon" size={14} />
                <span className="track-nav-copy">
                  <span className="track-nav-title">Records</span>
                  <span className="track-nav-meta">Project audit register</span>
                </span>
                <span className="track-nav-count">{projectRecords.length}</span>
              </Button>
              <Button
                className={view === 'settings' ? 'track-nav-item active' : 'track-nav-item'}
                onClick={navigateToProjectSettings}
                type="button"
              >
                <Settings2 className="track-nav-icon" size={14} />
                <span className="track-nav-copy">
                  <span className="track-nav-title">Settings</span>
                  <span className="track-nav-meta">Members, notifications</span>
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="track-nav-footer">
          <Avatar className={`track-avatar ${getAvatarTone(currentUserEmail)}`}>
            <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
          </Avatar>
          <div className="track-nav-copy">
            <span className="track-nav-title">{currentUserName}</span>
            <span className="track-nav-meta">{activeProject?.membership.role ?? 'owner'}</span>
          </div>
          <div className="track-nav-footer-actions">
            <ThemeToggle />
            <Button
              aria-label="Log out"
              className="track-nav-footer-button"
              onClick={() => void handleSignOut()}
              title="Log out"
              type="button"
            >
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      <section className="track-workspace">
        <header className="track-thread-header">
          <Button
            aria-label="Open navigation"
            className="icon-button track-mobile-menu-button"
            onClick={() => setMobileNavOpen(true)}
            type="button"
          >
            <Menu size={16} />
          </Button>
          <div className="track-header-title">
            <h1>
              {view === 'group' && activeGroup
                ? `${activeGroup.name} Conversation`
                : view === 'records' && activeProject
                  ? `${activeProject.project.name} Records`
                : view === 'settings' && activeProject
                  ? `${activeProject.project.name} Settings`
                : activeProject
                  ? `${activeProject.project.name} Groups`
                  : 'Select a Project'}
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
                  multiple
                  ref={fileInputRef}
                  type="file"
                />
              </>
            ) : null}
            {view !== 'settings' && view !== 'records' ? (
              <Button
                className="track-button"
                disabled={!activeProjectId || busyAction === 'invite'}
                onClick={handleInvite}
                type="button"
              >
                Invite
              </Button>
            ) : null}
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
            ) : view === 'project' ? (
              <Button
                className="track-button track-button-accent"
                disabled={!activeProjectId || busyAction === 'create-group'}
                onClick={handleCreateGroup}
                type="button"
              >
                <MessageSquarePlus size={14} />
                New Group
              </Button>
            ) : null}
          </div>
        </header>

        {uiError ? <div className="track-error">{uiError}</div> : null}

        {isProjectRouteLoading || isGroupRouteLoading ? (
          <WorkspaceRouteLoader label={view === 'group' ? 'Opening group conversation' : view === 'records' ? 'Loading project records' : view === 'settings' ? 'Loading project settings' : 'Loading project groups'} />
        ) : view === 'group' ? (
          <>
            <div className="track-thread-scroll">
              <div className="track-thread">
                {activeGroup && messages !== undefined && visibleMessages.length === 0 ? (
                  <div className="track-empty-conversation">
                    <span className="track-empty-conversation-icon">
                      <MessagesSquare size={22} />
                    </span>
                    <h2>{activeGroup.name} is ready</h2>
                    <p>
                      Start this group with a decision, question, scope note, or mention @track to turn the first
                      useful detail into project memory.
                    </p>
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
                {pendingAttachments.length > 0 ? (
                  <div className="track-composer-attachments" aria-label="Pending attachments">
                    {pendingAttachments.map((attachment) => (
                      <div className="track-composer-attachment" key={attachment.id}>
                        {attachment.previewUrl ? (
                          <img alt="" src={attachment.previewUrl} />
                        ) : (
                          <span className="track-composer-file-icon">
                            <FileText size={18} />
                          </span>
                        )}
                        <span className="track-composer-attachment-meta">
                          <strong>{attachment.file.name}</strong>
                          <small>{formatFileSize(attachment.file.size)}</small>
                        </span>
                        <button
                          aria-label={`Remove ${attachment.file.name}`}
                          className="track-composer-attachment-remove"
                          onClick={() => removePendingAttachment(attachment.id)}
                          type="button"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  aria-label={`Message ${activeGroup?.name ?? 'Group'}`}
                  disabled={!activeGroupId || busyAction === 'send-message'}
                  onBlur={handleComposerSelection}
                  onChange={(event) => {
                    setComposer(event.currentTarget.value)
                    setComposerCursor(event.currentTarget.selectionStart)
                    setEmojiPickerOpen(false)
                  }}
                  onKeyDown={(event) => {
                    if (emojiPickerOpen && event.key === 'Escape') {
                      event.preventDefault()
                      setEmojiPickerOpen(false)
                      return
                    }
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
                  onPaste={handleComposerPaste}
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
                {emojiPickerOpen ? (
                  <div className="track-emoji-picker" role="dialog" aria-label="Emoji picker">
                    {emojiGroups.map((group) => (
                      <div className="track-emoji-group" key={group.label}>
                        <p className="mono-label m-0">{group.label}</p>
                        <div className="track-emoji-grid">
                          {group.emojis.map((emoji) => (
                            <button
                              aria-label={`Insert ${emoji}`}
                              className="track-emoji-option"
                              key={`${group.label}-${emoji}`}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                insertComposerText(emoji)
                                setEmojiPickerOpen(false)
                              }}
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="track-composer-bar">
                  <Button
                    className="icon-button"
                    disabled={!activeGroupId || busyAction === 'send-message'}
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
                      setEmojiPickerOpen(false)
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
                  <Button
                    className="icon-button"
                    disabled={!activeGroupId}
                    onClick={() => {
                      setComposerCursor(composerRef.current?.selectionStart ?? composerCursor)
                      setEmojiPickerOpen((open) => !open)
                    }}
                    title="Emoji"
                    type="button"
                  >
                    <Smile size={15} />
                  </Button>
                  <span className="track-composer-hint">
                    <Sparkles size={12} />
                    AI auto-review on
                  </span>
                  <Button
                    className="track-button track-button-primary"
                    disabled={
                      (!composer.trim() && pendingAttachments.length === 0) ||
                      !activeGroupId ||
                      busyAction === 'send-message'
                    }
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
        ) : view === 'records' ? (
          <ProjectRecordsPage
            busyAction={busyAction}
            filteredRecords={filteredProjectRecords}
            onRecordStatus={handleRecordStatus}
            onRequestExport={handleRequestExport}
            recordFilter={recordFilter}
            recordSearchQuery={recordSearchQuery}
            records={projectRecords}
            setRecordFilter={setRecordFilter}
            setRecordSearchQuery={setRecordSearchQuery}
          />
        ) : view === 'settings' ? (
          <ProjectSettingsPage
            activeProject={activeProject?.project ?? null}
            globalNotificationMode={globalNotificationMode}
            groupNotificationSettings={groupNotificationSettings}
            groups={visibleGroups}
            members={activeProjectMembers}
            onInvite={handleInvite}
            onNotificationMode={handleNotificationMode}
          />
        ) : visibleGroups.length > 0 ? (
          <WorkspaceRouteLoader label="Opening first group" />
        ) : (
          <div className="track-empty">
            <p className="mono-label m-0">No groups</p>
            <p>Create a group to start tracking project conversations.</p>
          </div>
        )}
      </section>

      {view === 'group' ? (
        <aside className={railCollapsed ? 'track-rail collapsed' : 'track-rail'}>
          {railCollapsed ? (
            <button
              aria-label="Expand AI review panel"
              className="track-rail-collapse-button"
              onClick={() => setRailCollapsed(false)}
              type="button"
            >
              <PanelRightOpen size={15} />
            </button>
          ) : (
            <>
              <button
                aria-label="Resize AI review panel"
                className="track-rail-resize-handle"
                onPointerDown={(event) => {
                  event.preventDefault()
                  setRailResizing(true)
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
                      onClick={() => setRailCollapsed(true)}
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
                            onClick={() => void handleRequestExport('csv')}
                          >
                            Export csv
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!activeProjectId || busyAction === 'export-pdf'}
                            onClick={() => void handleRequestExport('pdf')}
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
                          <DropdownMenuItem onClick={() => void handleEnableBrowserNotifications()}>
                            {notificationPermission === 'granted' ? 'Reconnect browser alerts' : 'Enable browser alerts'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={busyAction === 'test-notifications'}
                            onClick={() => void handleSendTestNotification()}
                          >
                            Send test alert
                          </DropdownMenuItem>
                          {notificationStatus ? <p className="track-rail-menu-note">{notificationStatus}</p> : null}
                          <DropdownMenuSeparator />
                          <p className="track-rail-menu-note">Global: {formatRailLabel(globalNotificationMode)}</p>
                          <DropdownMenuRadioGroup
                            value={groupNotificationMode}
                            onValueChange={(mode) => void handleNotificationMode(mode as (typeof notificationModes)[number])}
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
                <div className="track-rail-inline-actions">
                  <Button
                    className="track-setting-button"
                    disabled={!activeGroupId || busyAction === 'review-frequency'}
                    onClick={handleFrequencyChange}
                    type="button"
                  >
                    Every {activeGroup?.aiReviewSettings?.frequencyMinutes ?? 30} minutes
                  </Button>
                </div>
                <p className="track-muted track-rail-compact-copy">{latestReview?.summary ?? 'Run AI Review to propose Draft Records from this Group.'}</p>
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
                          onStatus={(status) => handleRecordStatus(record._id, status)}
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
            </>
          )}
        </aside>
      ) : null}
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

function ProjectRecordsPage({
  busyAction,
  filteredRecords,
  onRecordStatus,
  onRequestExport,
  recordFilter,
  recordSearchQuery,
  records,
  setRecordFilter,
  setRecordSearchQuery,
}: {
  busyAction: string | null
  filteredRecords: Array<Doc<'records'>>
  onRecordStatus: (recordId: Id<'records'>, status: (typeof draftStatuses)[number]) => Promise<void>
  onRequestExport: (format: 'csv' | 'pdf') => Promise<void>
  recordFilter: 'all' | 'open' | 'billable' | 'blocked' | 'done'
  recordSearchQuery: string
  records: Array<Doc<'records'>>
  setRecordFilter: (filter: 'all' | 'open' | 'billable' | 'blocked' | 'done') => void
  setRecordSearchQuery: (query: string) => void
}) {
  const openRecords = records.filter((record) => record.status === 'open' || record.status === 'in_progress')
  const billableRecords = records.filter((record) => record.classification === 'billable_scope')
  const blockedRecords = records.filter((record) => record.status === 'blocked')
  const doneRecords = records.filter((record) => record.status === 'done')

  return (
    <div className="track-records-page">
      <section className="track-records-main">
        <div className="track-records-toolbar">
          <div className="track-record-filter-row" role="list" aria-label="Record filters">
            {[
              ['all', 'All', records.length],
              ['open', 'Open', openRecords.length],
              ['billable', 'Billable', billableRecords.length],
              ['blocked', 'Blocked', blockedRecords.length],
              ['done', 'Done', doneRecords.length],
            ].map(([value, label, count]) => (
              <button
                className={recordFilter === value ? 'track-record-filter active' : 'track-record-filter'}
                key={value}
                onClick={() => setRecordFilter(value as typeof recordFilter)}
                type="button"
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="track-record-tools">
            <Input
              className="track-record-search"
              onChange={(event) => setRecordSearchQuery(event.currentTarget.value)}
              placeholder="Search records..."
              value={recordSearchQuery}
            />
            <Button
              className="track-button"
              disabled={busyAction === 'export-csv'}
              onClick={() => void onRequestExport('csv')}
              type="button"
            >
              <Download size={14} />
              CSV
            </Button>
            <Button
              className="track-button track-button-primary"
              disabled={busyAction === 'export-pdf'}
              onClick={() => void onRequestExport('pdf')}
              type="button"
            >
              <Download size={14} />
              Audit packet
            </Button>
          </div>
        </div>

        <div className="track-record-table-wrap">
          <table className="track-record-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Type</th>
                <th>Class</th>
                <th>Status</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td className="track-record-title-cell">
                    <span className="track-record-id">R-{record._id.slice(-5).toUpperCase()}</span>
                    <strong>{record.title}</strong>
                    <small>{record.description}</small>
                  </td>
                  <td>
                    <Badge className="track-type-pill" variant="outline">
                      <span className="track-type-dot" />
                      {record.type.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      className={record.classification === 'billable_scope' ? 'track-badge success' : 'track-badge'}
                      variant="outline"
                    >
                      {record.classification.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <RecordStatusDropdown
                      ariaLabel={`Set status for ${record.title}`}
                      disabled={busyAction === `record-status-${record._id}`}
                      onStatus={(status) => onRecordStatus(record._id, status)}
                      status={record.status}
                    />
                  </td>
                  <td className="track-record-time-cell">
                    {new Date(record.reviewedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td className="track-record-empty-row" colSpan={5}>
                    No records match this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function RecordStatusDropdown({
  ariaLabel,
  disabled,
  onStatus,
  status,
}: {
  ariaLabel: string
  disabled: boolean
  onStatus: (status: (typeof draftStatuses)[number]) => Promise<void>
  status: Doc<'records'>['status']
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="track-status-menu-trigger"
        disabled={disabled}
      >
        {formatRailLabel(status)}
        <ChevronDown size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="track-status-menu">
        <DropdownMenuRadioGroup
          onValueChange={(nextStatus) => void onStatus(nextStatus as (typeof draftStatuses)[number])}
          value={status}
        >
          {draftStatuses.map((nextStatus) => (
            <DropdownMenuRadioItem className="track-status-menu-item" key={nextStatus} value={nextStatus}>
              {formatRailLabel(nextStatus)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectSettingsPage({
  activeProject,
  globalNotificationMode,
  groupNotificationSettings,
  groups,
  members,
  onInvite,
  onNotificationMode,
}: {
  activeProject: Doc<'projects'> | null
  globalNotificationMode: (typeof notificationModes)[number]
  groupNotificationSettings: Array<Doc<'groupNotificationSettings'>>
  groups: Array<Doc<'groups'>>
  members: Array<{ membership: Doc<'projectMembers'>; user: Doc<'users'> | null }>
  onInvite: () => Promise<void>
  onNotificationMode: (mode: (typeof notificationModes)[number]) => Promise<void>
}) {
  return (
    <div className="track-settings-page">
      <section className="track-settings-panel">
        <div className="track-settings-section">
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
            <span>Client label</span>
            <strong>{activeProject?.clientLabel ?? 'None'}</strong>
          </div>
          <div className="track-settings-row">
            <span>Groups</span>
            <strong>{groups.length}</strong>
          </div>
        </div>

        <div className="track-settings-section">
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
            <span>Group overrides</span>
            <strong>{groupNotificationSettings.length}</strong>
          </div>
        </div>

        <div className="track-settings-section">
          <div className="track-settings-section-head">
            <div>
              <span className="mono-label">Access</span>
              <h2>Project members</h2>
            </div>
            <Upload size={14} />
          </div>
          <div className="track-settings-row">
            <span>Members</span>
            <strong>{members.length}</strong>
          </div>
          <div className="track-settings-row">
            <span>Reviewers</span>
            <strong>{members.filter((member) => member.membership.canReviewAiRecords).length}</strong>
          </div>
          <div className="track-settings-actions">
            <Button className="track-button" onClick={() => void onInvite()} type="button">
              Invite member
            </Button>
          </div>
        </div>
      </section>
    </div>
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

function WorkspaceRouteLoader({ label }: { label: string }) {
  return (
    <div className="track-route-loader" role="status" aria-live="polite">
      <LoaderCircle className="track-route-loader-icon" size={18} />
      <span>{label}</span>
    </div>
  )
}
