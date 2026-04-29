import { Navigate, useNavigate, useRouter } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AtSign,
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  CornerUpLeft,
  Download,
  FileCheck2,
  FolderKanban,
  GripVertical,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Search,
  Settings2,
  Smile,
  Upload,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
import { AttachmentTypeIcon, formatFileSize } from '#/features/workspace/attachment-ui'
import { AvatarNameTooltip } from '#/features/workspace/avatar-tooltip'
import { draftClassifications, draftStatuses, notificationModes } from '#/features/workspace/constants'
import { getGroupAvatar } from '#/features/workspace/group-avatar'
import { getActiveMention, getAvatarTone, getInitials, getMentionHandle } from '#/features/workspace/identity'
import { AssistantAnswer, DraftRecordCard, MessageRow, Metric } from '#/features/workspace/thread-items'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import {
  TYPING_INDICATOR_HEARTBEAT_MS,
  TypingIndicatorLine,
  filterActiveTypingIndicators,
} from '#/features/workspace/typing-indicators'
import {
  getWebPushDiagnostics,
  getNotificationPermission,
  notificationPermissionLabels,
  requestNotificationPermission,
  serializePushSubscription,
  shouldNotifyForIncomingMessage,
  showMessageNotification,
  subscribeToWebPush,
  type WebNotificationPermission,
} from '#/features/workspace/web-notifications'
import {
  VoiceNoteReview,
  VoiceRecorder,
  isVoiceNoteAttachment,
  formatVoiceDuration,
} from '#/features/workspace/voice-notes'
import { WorkspaceDialogs } from '#/features/workspace/workspace-dialogs'
import { authClient } from '#/lib/auth-client'
import { disableDevAuthBypass, useDevAuthBypass } from '#/lib/dev-auth-bypass'
import ThemeToggle from '#/components/ThemeToggle'
import TrackLoader from '#/components/TrackLoader'

type WorkspacePageProps = {
  groupId?: string
  projectId?: string
  view?: 'home' | 'project' | 'group' | 'records' | 'settings'
}

type ProjectSearchFilter = 'all' | 'messages' | 'records' | 'files' | 'groups'

type ProjectSearchResult = {
  attachmentId?: Id<'attachments'>
  contentType?: string
  createdAt: number
  groupId: Id<'groups'>
  groupName: string
  id: string
  kind: 'message' | 'record' | 'file' | 'group'
  messageId?: Id<'messages'>
  preview: string
  recordId?: Id<'records'>
  subtitle: string
  title: string
}

type ChatSearchMatch = {
  key: string
  kind: 'assistant' | 'draft' | 'message'
  messageId?: Id<'messages'>
}

function ignoreTypingIndicatorError() {
  return undefined
}

export function findVisibleRouteGroupId(
  routeGroupId: string | undefined,
  visibleGroups: Array<Pick<Doc<'groups'>, '_id'>>,
) {
  if (!routeGroupId) return null
  return visibleGroups.find((group) => group._id === routeGroupId)?._id ?? null
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

function createPendingAttachment(
  file: File,
  metadata: { durationMs?: number; kind?: 'file' | 'voice_note'; previewUrl?: string | null } = {},
) {
  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    durationMs: metadata.durationMs,
    kind: metadata.kind ?? 'file',
    previewUrl: metadata.previewUrl ?? (file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
  }
}

function formatRailLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function getThreadDayKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatThreadDayLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (getThreadDayKey(timestamp) === getThreadDayKey(today.getTime())) return 'Today'
  if (getThreadDayKey(timestamp) === getThreadDayKey(yesterday.getTime())) return 'Yesterday'

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export function WorkspacePage({ groupId, projectId, view = 'home' }: WorkspacePageProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const session = authClient.useSession()
  const syncCurrentUser = useMutation(api.auth.syncGoogleUser)
  const syncDevUser = useMutation(api.auth.syncDevUser)
  const ensureStarterProject = useMutation(api.projects.ensureStarter)
  const createProject = useMutation(api.projects.create)
  const createGroup = useMutation(api.groups.create)
  const createInvitation = useMutation(api.invitations.create)
  const acceptPendingInvitations = useMutation(api.invitations.acceptPendingForCurrentUser)
  const updateGroupAiReviewSettings = useMutation(api.groups.updateAiReviewSettings)
  const sendMessageMutation = useMutation(api.messages.send)
  const forwardMessageMutation = useMutation(api.messages.forwardMessage)
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl)
  const attachFileMutation = useMutation(api.messages.attachFile)
  const classifyDraftMutation = useMutation(api.records.classifyDraft)
  const updateRecordStatus = useMutation(api.records.updateStatus)
  const askTrackAction = useAction(api.assistant.ask)
  const sendTestPushAction = useAction(api.pushNotifications.sendTestNotification)
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode)
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode)
  const registerNotificationSubscription = useMutation(api.notifications.registerSubscription)
  const requestExport = useMutation(api.exports.request)
  const heartbeatTypingIndicator = useMutation(api.typingIndicators.heartbeat)
  const clearTypingIndicator = useMutation(api.typingIndicators.clear)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null)
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null)
  const [composer, setComposer] = useState('')
  const [replyToMessage, setReplyToMessage] = useState<GroupMessageItem | null>(null)
  const [composerFocused, setComposerFocused] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<Array<ReturnType<typeof createPendingAttachment>>>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const [composerCursor, setComposerCursor] = useState(0)
  const [typingNow, setTypingNow] = useState(() => Date.now())
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [mentionIndex, setMentionIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [activeChatMatchIndex, setActiveChatMatchIndex] = useState(0)
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [projectSearchFilter, setProjectSearchFilter] = useState<ProjectSearchFilter>('all')
  const [recordSearchQuery, setRecordSearchQuery] = useState('')
  const [recordFilter, setRecordFilter] = useState<'all' | 'open' | 'billable' | 'blocked' | 'done'>('all')
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [frequencyDialogOpen, setFrequencyDialogOpen] = useState(false)
  const [reviewEnabledInput, setReviewEnabledInput] = useState(true)
  const [projectName, setProjectName] = useState('')
  const [projectClientLabel, setProjectClientLabel] = useState('')
  const [groupName, setGroupName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff' | 'client'>('staff')
  const [inviteCanReview, setInviteCanReview] = useState(true)
  const [inviteScope, setInviteScope] = useState<'project' | 'group'>('project')
  const [frequencyMinutesInput, setFrequencyMinutesInput] = useState('30')
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('track-nav-collapsed') === 'true'
  })
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [railWidth, setRailWidth] = useState(312)
  const [railResizing, setRailResizing] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [flashingMessageId, setFlashingMessageId] = useState<string | null>(null)
  const [pendingFocusMessageId, setPendingFocusMessageId] = useState<string | null>(null)
  const [voiceRecordingActive, setVoiceRecordingActive] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<WebNotificationPermission>(getNotificationPermission)
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const mentionOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const shouldFollowLatestRef = useRef(true)
  const lastLoadedGroupIdRef = useRef<Id<'groups'> | null>(null)
  const flashMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingAttachmentsRef = useRef<Array<ReturnType<typeof createPendingAttachment>>>([])
  const hydratedNotificationMessagesRef = useRef(false)
  const notifiedMessageIdsRef = useRef(new Set<string>())
  const registeredPushUserRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (flashMessageTimeoutRef.current) {
        clearTimeout(flashMessageTimeoutRef.current)
      }
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
  const devAuthBypass = useDevAuthBypass()
  const sessionUser = useMemo(
    () => getSessionUser(session.data ?? devAuthBypass.sessionData),
    [devAuthBypass.sessionData, session.data],
  )
  const hasSessionAccess = Boolean(session.data || devAuthBypass.enabled)

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
  const visibleGroups = useMemo(() => (groups ?? []) as Array<Doc<'groups'>>, [groups])
  const confirmedActiveGroupId =
    groups !== undefined && activeGroupId && visibleGroups.some((group) => group._id === activeGroupId)
      ? activeGroupId
      : null
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 80 }
      : 'skip',
  )
  const typingIndicators = useQuery(
    api.typingIndicators.list,
    trackUserId && confirmedActiveGroupId
      ? {
          groupId: confirmedActiveGroupId,
          userId: trackUserId,
        }
      : 'skip',
  )
  const drafts = useQuery(
    api.records.listDrafts,
    trackUserId && activeProjectId && confirmedActiveGroupId
      ? { userId: trackUserId, projectId: activeProjectId, groupId: confirmedActiveGroupId }
      : 'skip',
  )
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const projectSearchResults = useQuery(
    api.search.project,
    trackUserId && activeProjectId && projectSearchOpen && projectSearchQuery.trim().length >= 2
      ? {
          filter: projectSearchFilter,
          limit: 8,
          projectId: activeProjectId,
          query: projectSearchQuery,
          userId: trackUserId,
        }
      : 'skip',
  )
  const latestReview = useQuery(
    api.ai.latestForGroup,
    trackUserId && confirmedActiveGroupId ? { userId: trackUserId, groupId: confirmedActiveGroupId } : 'skip',
  )
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && confirmedActiveGroupId
      ? { userId: trackUserId, groupId: confirmedActiveGroupId, limit: 20 }
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
    const reservedHandles = new Set(['track', ...members.map((member) => member.handle)])
    const groupMentions = visibleGroups
      .map((group) => ({
        id: group._id,
        kind: 'group' as const,
        label: group.name,
        sublabel: 'group',
        handle: getMentionHandle(group.name),
        tone: getGroupAvatar(group).tone,
      }))
      .filter((group) => group.handle && !reservedHandles.has(group.handle))

    return [
      {
        id: 'track',
        kind: 'assistant' as const,
        label: 'Track Assistant',
        sublabel: 'ai review',
        handle: 'track',
        tone: 'bot',
      },
      ...groupMentions,
      ...members,
    ]
  }, [activeProjectMembers, visibleGroups])
  const mentionGroups = useMemo(() => {
    const groupsByHandle = new Map<string, Doc<'groups'>>()
    const reservedHandles = new Set([
      'track',
      ...activeProjectMembers
        .filter((item) => item.user)
        .map((item) => {
          const user = item.user as Doc<'users'>
          return getMentionHandle(user.displayName) || getMentionHandle(user.email)
        }),
    ])
    for (const group of visibleGroups) {
      const handle = getMentionHandle(group.name)
      if (handle && !reservedHandles.has(handle)) groupsByHandle.set(handle, group)
    }
    return groupsByHandle
  }, [activeProjectMembers, visibleGroups])
  const activeMention = useMemo(
    () => getActiveMention(composer, composerCursor),
    [composer, composerCursor],
  )
  const filteredMentionOptions = useMemo(() => {
    if (!activeMention) return []
    const query = activeMention.query
    const assistantOptions = mentionOptions
      .filter((option) => option.kind === 'assistant')
      .filter(
        (option) =>
          option.handle.includes(query) ||
          option.label.toLowerCase().includes(query) ||
          option.sublabel.toLowerCase().includes(query),
      )
    const groupOptions = mentionOptions
      .filter((option) => option.kind === 'group')
      .filter(
        (option) =>
          option.handle.includes(query) ||
          option.label.toLowerCase().includes(query) ||
          option.sublabel.toLowerCase().includes(query),
      )
      .slice(0, 4)
    const memberOptions = mentionOptions
      .filter((option) => option.kind === 'member')
      .filter(
        (option) =>
          option.handle.includes(query) ||
          option.label.toLowerCase().includes(query) ||
          option.sublabel.toLowerCase().includes(query),
      )
      .slice(0, 4)
    return [...assistantOptions, ...groupOptions, ...memberOptions].slice(0, 9)
  }, [activeMention, mentionOptions])
  const mentionSections = useMemo(
    () =>
      [
        {
          label: 'Groups',
          options: filteredMentionOptions.filter((option) => option.kind === 'group'),
        },
        {
          label: 'People',
          options: filteredMentionOptions.filter((option) => option.kind === 'member'),
        },
        {
          label: 'Assistant',
          options: filteredMentionOptions.filter((option) => option.kind === 'assistant'),
        },
      ].filter((section) => section.options.length > 0),
    [filteredMentionOptions],
  )
  const showMentionMenu = activeMention !== null && filteredMentionOptions.length > 0
  const composerHasTypingText = composer.trim().length > 0
  const composingActivity = useMemo<'typing' | 'attaching' | 'recording' | null>(() => {
    if (voiceRecordingActive) return 'recording' as const
    if (composerFocused && composerHasTypingText) return 'typing' as const
    if (pendingAttachments.length > 0) return 'attaching' as const
    return null
  }, [composerFocused, composerHasTypingText, pendingAttachments.length, voiceRecordingActive])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('track-nav-collapsed', String(navCollapsed))
  }, [navCollapsed])

  useEffect(() => {
    setLogoutConfirmOpen(false)
  }, [navCollapsed])

  const groupMessages = useMemo(
    () => (messages ?? []) as Array<GroupMessageItem>,
    [messages],
  )
  const activeTypingIndicators = useMemo(
    () => filterActiveTypingIndicators(typingIndicators ?? [], typingNow),
    [typingIndicators, typingNow],
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
    if (!showMentionMenu) return
    mentionOptionRefs.current[mentionIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [mentionIndex, showMentionMenu])

  useEffect(() => {
    if (view !== 'group' || !activeGroupId) return
    setTypingNow(Date.now())
    const intervalId = window.setInterval(() => {
      setTypingNow(Date.now())
    }, TYPING_INDICATOR_HEARTBEAT_MS)
    return () => window.clearInterval(intervalId)
  }, [activeGroupId, view])

  useEffect(() => {
    setReplyToMessage(null)
  }, [activeGroupId])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) setComposerFocused(false)
    }
    function handleOnline() {
      setBrowserOnline(true)
    }
    function handleOffline() {
      setBrowserOnline(false)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (
      view !== 'group' ||
      !trackUserId ||
      !activeProjectId ||
      !activeGroupId ||
      !browserOnline ||
      document.hidden ||
      !composingActivity
    ) {
      return
    }

    const heartbeatArgs = {
      projectId: activeProjectId,
      groupId: activeGroupId,
      userId: trackUserId,
      activity: composingActivity,
    }
    const clearArgs = {
      groupId: activeGroupId,
      userId: trackUserId,
    }
    void heartbeatTypingIndicator(heartbeatArgs).catch(ignoreTypingIndicatorError)
    const intervalId = window.setInterval(() => {
      void heartbeatTypingIndicator(heartbeatArgs).catch(ignoreTypingIndicatorError)
    }, TYPING_INDICATOR_HEARTBEAT_MS)

    return () => {
      window.clearInterval(intervalId)
      void clearTypingIndicator(clearArgs).catch(ignoreTypingIndicatorError)
    }
  }, [
    activeGroupId,
    activeProjectId,
    browserOnline,
    clearTypingIndicator,
    composingActivity,
    heartbeatTypingIndicator,
    trackUserId,
    view,
  ])

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
    if (!sessionUser?.id || trackUserId) return
    if (devAuthBypass.enabled && !session.data) {
      void syncDevUser()
        .then(async (userId) => {
          setTrackUserId(userId)
          await acceptPendingInvitations({ userId })
        })
        .catch(setActionError)
      return
    }

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
  }, [
    acceptPendingInvitations,
    devAuthBypass.enabled,
    session.data,
    sessionUser?.email,
    sessionUser?.id,
    sessionUser?.name,
    syncCurrentUser,
    syncDevUser,
    trackUserId,
  ])

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
      setShowJumpToLatest(false)
      return
    }
    if (routeGroupId) {
      if (groups === undefined) return
      const visibleRouteGroupId = findVisibleRouteGroupId(routeGroupId, visibleGroups)
      if (visibleRouteGroupId) {
        if (activeGroupId !== visibleRouteGroupId) {
          setActiveGroupId(visibleRouteGroupId)
        }
        return
      }
      if (activeGroupId !== null) {
        setActiveGroupId(null)
      }
      if (visibleGroups.length) {
        const firstGroupId = visibleGroups[0]?._id
        const projectIdToOpen = activeProjectId ?? routeProjectId
        if (firstGroupId && projectIdToOpen) {
          void navigate({
            to: '/workspace/projects/$projectId/groups/$groupId',
            params: { groupId: firstGroupId, projectId: projectIdToOpen },
          })
        }
      } else {
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
  }, [activeGroupId, activeProjectId, groups, navigate, routeGroupId, routeProjectId, view, visibleGroups])

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
  const chatSearchTerm = chatSearchQuery.trim()
  const chatSearchMatches = useMemo<ChatSearchMatch[]>(() => {
    const query = chatSearchTerm.toLowerCase()
    if (!query) return []

    const matches: ChatSearchMatch[] = []
    for (const threadItem of threadItems) {
      if (threadItem.kind === 'message') {
        const body = threadItem.item.message.body.toLowerCase()
        const author = threadItem.item.author?.displayName.toLowerCase() ?? ''
        if (body.includes(query) || author.includes(query)) {
          matches.push({
            key: threadItem.key,
            kind: threadItem.kind,
            messageId: threadItem.item.message._id,
          })
        }
        continue
      }
      if (threadItem.kind === 'assistant') {
        if (threadItem.stream.answer.toLowerCase().includes(query)) {
          matches.push({ key: threadItem.key, kind: threadItem.kind })
        }
        continue
      }
      const draftText = `${threadItem.draft.title} ${threadItem.draft.description}`.toLowerCase()
      if (draftText.includes(query)) {
        matches.push({ key: threadItem.key, kind: threadItem.kind })
      }
    }

    return matches
  }, [chatSearchTerm, threadItems])
  const chatSearchMatchKeys = useMemo(
    () => new Set(chatSearchMatches.map((match) => match.key)),
    [chatSearchMatches],
  )
  const activeChatMatch = chatSearchMatches[activeChatMatchIndex] ?? null
  const latestThreadItemKey = threadItems.at(-1)?.key ?? null

  useEffect(() => {
    if (view !== 'group' || messages === undefined) return
    const hasLoadedNewGroup = lastLoadedGroupIdRef.current !== activeGroupId
    if (!hasLoadedNewGroup) return
    lastLoadedGroupIdRef.current = activeGroupId
    shouldFollowLatestRef.current = true
    requestThreadScrollToLatest('auto')
    requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true })
    })
  }, [activeGroupId, messages, view])

  useEffect(() => {
    if (view !== 'group') {
      lastLoadedGroupIdRef.current = null
    }
  }, [view])

  useEffect(() => {
    if (view !== 'group') return
    requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true })
    })
  }, [activeGroupId, view])

  useEffect(() => {
    if (view !== 'group' || chatSearchQuery.trim()) return
    if (shouldFollowLatestRef.current) {
      requestThreadScrollToLatest('smooth')
    }
  }, [chatSearchQuery, latestThreadItemKey, view])

  useEffect(() => {
    setActiveChatMatchIndex(0)
  }, [chatSearchTerm])

  useEffect(() => {
    if (activeChatMatchIndex < chatSearchMatches.length) return
    setActiveChatMatchIndex(Math.max(chatSearchMatches.length - 1, 0))
  }, [activeChatMatchIndex, chatSearchMatches.length])

  useEffect(() => {
    if (view !== 'group' || !activeChatMatch) return
    requestThreadItemScroll(activeChatMatch.key)
    if (activeChatMatch.kind === 'message' && activeChatMatch.messageId) {
      requestMessageFlash(activeChatMatch.messageId)
    }
  }, [activeChatMatch, view])

  useEffect(() => {
    if (view !== 'group' || !pendingFocusMessageId || messages === undefined) return
    if (!visibleMessages.some((item) => item.message._id === pendingFocusMessageId)) return
    requestMessageFocus(pendingFocusMessageId)
    setPendingFocusMessageId(null)
  }, [messages, pendingFocusMessageId, view, visibleMessages])

  useEffect(() => {
    function handleProjectSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setProjectSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleProjectSearchShortcut)
    return () => window.removeEventListener('keydown', handleProjectSearchShortcut)
  }, [])

  useEffect(() => {
    function handleChatSearchShortcut(event: KeyboardEvent) {
      if (view !== 'group' || event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      const composerElement = composerRef.current
      const isEmptyComposer =
        composerElement !== null &&
        target === composerElement &&
        composerElement.value.trim().length === 0
      if (isEditable && !isEmptyComposer) return

      event.preventDefault()
      setSearchOpen(true)
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('.track-chat-search-popover-input')?.focus()
      })
    }

    window.addEventListener('keydown', handleChatSearchShortcut)
    return () => window.removeEventListener('keydown', handleChatSearchShortcut)
  }, [view])

  function requestThreadScrollToLatest(behavior: ScrollBehavior = 'smooth') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollThreadToLatest(behavior))
    })
  }

  function requestThreadItemScroll(threadItemKey: string, behavior: ScrollBehavior = 'smooth') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollThreadItemIntoView(threadItemKey, behavior))
    })
  }

  function requestMessageFocus(messageId: Id<'messages'> | string, behavior: ScrollBehavior = 'smooth') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`message-${messageId}`)?.scrollIntoView({
          behavior,
          block: 'center',
        })
        requestMessageFlash(messageId)
      })
    })
  }

  function requestMessageFlash(messageId: Id<'messages'> | string) {
    if (flashMessageTimeoutRef.current) {
      clearTimeout(flashMessageTimeoutRef.current)
    }
    setFlashingMessageId(String(messageId))
    flashMessageTimeoutRef.current = setTimeout(() => {
      setFlashingMessageId(null)
      flashMessageTimeoutRef.current = null
    }, 1500)
  }

  const headerMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(0, 5),
    [activeProjectMembers],
  )
  const hiddenHeaderMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(headerMembers.length),
    [activeProjectMembers, headerMembers.length],
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
            body: item.message.body.slice(0, 90),
            createdAt: item.message.createdAt,
          },
        ]),
      ),
    [visibleMessages],
  )
  const projectSearchSections = useMemo(
    () => [
      {
        key: 'messages',
        label: 'Messages',
        results: (projectSearchResults?.messages ?? []) as ProjectSearchResult[],
      },
      {
        key: 'records',
        label: 'Records',
        results: (projectSearchResults?.records ?? []) as ProjectSearchResult[],
      },
      {
        key: 'files',
        label: 'Files',
        results: (projectSearchResults?.files ?? []) as ProjectSearchResult[],
      },
      {
        key: 'groups',
        label: 'Groups',
        results: (projectSearchResults?.groups ?? []) as ProjectSearchResult[],
      },
    ],
    [projectSearchResults],
  )
  const projectSearchTotal = projectSearchSections.reduce(
    (total, section) => total + section.results.length,
    0,
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

    const notificationBody =
      latestMessage.message.body ||
      (latestMessage.attachments.some(({ attachment }) => attachment.kind === 'voice_note')
        ? 'Sent a voice note.'
        : latestMessage.attachments.length > 0
          ? 'Sent an attachment.'
          : 'New message.')

    void showMessageNotification({
      title: `${latestMessage.author?.displayName ?? 'New message'} in ${activeGroup.name}`,
      body: notificationBody.slice(0, 160),
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

  if (session.isPending && !devAuthBypass.enabled) return <TrackLoading label="Checking your session" />
  if (!hasSessionAccess) return <Navigate to="/sign-in" />
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
    setReviewEnabledInput(activeGroup?.aiReviewSettings?.enabled ?? true)
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
      const messageBody = body
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
          durationMs: pendingAttachment.durationMs,
          filename: pendingAttachment.file.name,
          kind: pendingAttachment.kind,
          size: pendingAttachment.file.size,
          storageId,
        }
      }))
      const hasVoiceNote = pendingAttachments.some((attachment) => attachment.kind === 'voice_note')
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: messageBody,
        mentions: mentionedUserIds,
        replyToMessageId: replyToMessage?.message._id,
        notificationPreview: messageBody
          ? undefined
          : hasVoiceNote
            ? 'Sent a voice note.'
            : pendingAttachments.length > 0
              ? 'Sent an attachment.'
              : undefined,
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
          kind: attachment.kind,
          durationMs: attachment.durationMs,
        })
      }
      if (mentionHandles.includes('track')) {
        await askTrackAction({
          projectId: activeProjectId,
          groupId: activeGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: messageBody,
        })
      }
      setComposer('')
      setComposerCursor(0)
      setReplyToMessage(null)
      clearPendingAttachments()
      shouldFollowLatestRef.current = true
      requestThreadScrollToLatest('smooth')
      requestAnimationFrame(() => {
        composerRef.current?.focus({ preventScroll: true })
      })
    })
  }

  function handleReplyMessage(item: GroupMessageItem) {
    if (item.message.groupId !== activeGroupId) return
    setReplyToMessage(item)
    requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }))
  }

  async function handleForwardMessage(input: {
    sourceMessageId: Id<'messages'>
    targetGroupId: Id<'groups'>
    body: string
  }) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return false
    setBusyAction(`forward-${input.sourceMessageId}`)
    setUiError(null)
    try {
      const body = input.body.trim()
      const mentionHandles = parseMentions(body)
      const mentionedUserIds: Array<Id<'users'>> = []
      for (const handle of mentionHandles) {
        const option = mentionOptions.find((item) => item.kind === 'member' && item.handle === handle)
        if (option?.kind === 'member') mentionedUserIds.push(option.id)
      }
      const messageId = await forwardMessageMutation({
        projectId: activeProjectId,
        sourceMessageId: input.sourceMessageId,
        targetGroupId: input.targetGroupId,
        actorId: trackUserId,
        body,
        mentions: mentionedUserIds,
      })
      if (mentionHandles.includes('track')) {
        await askTrackAction({
          projectId: activeProjectId,
          groupId: input.targetGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: body,
        })
      }
      return true
    } catch (error) {
      setActionError(error)
      return false
    } finally {
      setBusyAction(null)
    }
  }

  function handleOpenMessageSource(groupIdToOpen: Id<'groups'>, messageIdToOpen: Id<'messages'>) {
    if (!activeProjectId) return
    navigateToGroup(groupIdToOpen)
    setPendingFocusMessageId(messageIdToOpen)
    if (groupIdToOpen === activeGroupId) {
      requestMessageFocus(messageIdToOpen)
    }
  }

  function scrollThreadToLatest(behavior: ScrollBehavior = 'smooth') {
    const scrollElement = threadScrollRef.current
    if (!scrollElement) return
    scrollElement.scrollTo({
      top: scrollElement.scrollHeight,
      behavior,
    })
    shouldFollowLatestRef.current = true
    setShowJumpToLatest(false)
  }

  function scrollThreadItemIntoView(threadItemKey: string, behavior: ScrollBehavior = 'smooth') {
    const scrollElement = threadScrollRef.current
    const target = scrollElement?.querySelector<HTMLElement>(
      `[data-thread-item-key="${CSS.escape(threadItemKey)}"]`,
    )
    if (!target) return
    target.scrollIntoView({ behavior, block: 'center' })
    shouldFollowLatestRef.current = false
    setShowJumpToLatest(true)
  }

  function handleThreadScroll() {
    const scrollElement = threadScrollRef.current
    if (!scrollElement) return
    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight
    const isAwayFromLatest = distanceFromBottom > 220
    shouldFollowLatestRef.current = distanceFromBottom < 180
    setShowJumpToLatest(isAwayFromLatest)
  }

  function handleComposerSelection() {
    setComposerCursor(composerRef.current?.selectionStart ?? composer.length)
  }

  function handleComposerFocus() {
    setComposerFocused(true)
    handleComposerSelection()
  }

  function handleComposerBlur() {
    handleComposerSelection()
    setComposerFocused(false)
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
    event.preventDefault()
    addPendingAttachments(files)
  }

  function addPendingAttachments(files: Array<File>) {
    setPendingAttachments((attachments) => [
      ...attachments,
      ...files.map((file) => createPendingAttachment(file)),
    ])
    setEmojiPickerOpen(false)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function handleVoiceNoteRecorded(recording: { file: File; durationMs: number; previewUrl: string }) {
    setPendingAttachments((attachments) => [
      ...attachments,
      createPendingAttachment(recording.file, {
        durationMs: recording.durationMs,
        kind: 'voice_note',
        previewUrl: recording.previewUrl,
      }),
    ])
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
        enabled: reviewEnabledInput,
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
    setBusyAction('notifications')
    setUiError(null)
    try {
      const permission = await requestNotificationPermission()
      setNotificationPermission(permission)
      if (permission === 'denied') {
        throw new Error('Browser notifications are blocked for Track.')
      }
      if (permission === 'unsupported') {
        throw new Error('This browser does not support web notifications.')
      }
      if (permission === 'granted') {
        await registerBrowserPushSubscription({
          onStep: (step) => setNotificationStatus(`${step} (${getWebPushDiagnostics()})`),
        })
        await showMessageNotification({
          title: 'Track notifications enabled',
          body: 'You will get alerts for new project messages.',
          tag: 'track-notifications-enabled',
          url: window.location.pathname,
        })
        setNotificationStatus('Browser alerts reconnected.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser alert reconnect failed.'
      setNotificationStatus(`${message} (${getWebPushDiagnostics()})`)
      setActionError(error)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSendTestNotification() {
    if (!trackUserId) return
    setNotificationStatus(null)
    setBusyAction('test-notifications')
    setUiError(null)
    try {
      let permission = getNotificationPermission()
      if (permission === 'default') {
        permission = await requestNotificationPermission()
        setNotificationPermission(permission as WebNotificationPermission)
      }
      if (permission !== 'granted') {
        throw new Error(permission === 'denied' ? 'Browser notifications are blocked for Track.' : 'Browser notifications are not enabled.')
      }

      await registerBrowserPushSubscription({
        onStep: (step) => setNotificationStatus(`${step} (${getWebPushDiagnostics()})`),
      })
      setNotificationStatus(`Sending server test... (${getWebPushDiagnostics()})`)
      const result = await sendTestPushAction({ userId: trackUserId })
      if (result.attempted === 0) {
        throw new Error('No browser push subscription was saved yet. Try reconnecting alerts and keep this tab open for a moment.')
      }
      if (result.sent === 0) {
        throw new Error('Track found your browser subscription, but the push service rejected the test alert.')
      }
      setNotificationStatus(`Test alert sent to ${result.sent} browser${result.sent === 1 ? '' : 's'}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test alert failed.'
      setNotificationStatus(`${message} (${getWebPushDiagnostics()})`)
      setActionError(error)
    } finally {
      setBusyAction(null)
    }
  }

  async function registerBrowserPushSubscription(options: { forceRefresh?: boolean; onStep?: (step: string) => void } = {}) {
    if (!trackUserId) return
    if (!webPushPublicKey) {
      throw new Error('Web push is not configured for this environment.')
    }
    const subscription = await subscribeToWebPush(webPushPublicKey, options)
    options.onStep?.('Saving push subscription...')
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

  function preloadProjectRoute(projectIdToOpen: Id<'projects'>) {
    void router.preloadRoute({
      to: '/workspace/projects/$projectId',
      params: { projectId: projectIdToOpen },
    }).catch(() => undefined)
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

  function preloadGroupRoute(groupIdToOpen: Id<'groups'>) {
    if (!activeProjectId) return
    void router.preloadRoute({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId: groupIdToOpen, projectId: activeProjectId },
    }).catch(() => undefined)
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

  function preloadProjectRecordsRoute() {
    if (!activeProjectId) return
    void router.preloadRoute({
      to: '/workspace/projects/$projectId/records',
      params: { projectId: activeProjectId },
    }).catch(() => undefined)
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

  function preloadProjectSettingsRoute() {
    if (!activeProjectId) return
    void router.preloadRoute({
      to: '/workspace/projects/$projectId/settings',
      params: { projectId: activeProjectId },
    }).catch(() => undefined)
  }

  function cycleChatSearchMatch(direction: 1 | -1) {
    if (chatSearchMatches.length === 0) return
    setActiveChatMatchIndex((index) =>
      (index + direction + chatSearchMatches.length) % chatSearchMatches.length,
    )
  }

  function handleProjectSearchResult(result: ProjectSearchResult) {
    setProjectSearchOpen(false)
    setProjectSearchQuery('')
    setMobileNavOpen(false)

    if (result.kind === 'record') {
      setRecordSearchQuery(result.title)
      navigateToProjectRecords()
      return
    }

    if (result.kind === 'group') {
      navigateToGroup(result.groupId)
      return
    }

    navigateToGroup(result.groupId)
    if (result.messageId) {
      setPendingFocusMessageId(result.messageId)
      if (result.groupId === activeGroupId) {
        requestMessageFocus(result.messageId)
      }
    }
  }

  async function handleSignOut() {
    setLogoutConfirmOpen(false)
    disableDevAuthBypass()
    await authClient.signOut()
    await navigate({ to: '/sign-in' })
  }

  return (
    <main
      className={[
        'track-app-shell',
        navCollapsed ? 'track-app-shell-nav-collapsed' : '',
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

      <aside
        className={[
          'track-nav',
          mobileNavOpen ? 'mobile-open' : '',
          navCollapsed ? 'collapsed' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="track-brand">
          <img
            alt=""
            className="track-brand-mark"
            height={24}
            src="/track-mark.svg"
            width={35}
          />
          <span className="track-brand-word">Track</span>
          <button
            aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={navCollapsed}
            className="track-nav-collapse-button"
            onClick={() => setNavCollapsed((isCollapsed) => !isCollapsed)}
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            type="button"
          >
            {navCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        <div className="track-current-project">
          <span className="track-nav-section-label">Project</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Switch project: ${activeProject?.project.name ?? 'Select a project'}`}
              className="track-current-project-card"
              disabled={!projectItems.length}
              title={navCollapsed ? activeProject?.project.name ?? 'Select a project' : undefined}
            >
              <FolderKanban className="track-nav-icon" size={14} />
              <span className="track-nav-copy">
                <span className="track-nav-title">{activeProject?.project.name ?? 'Select a project'}</span>
                <span className="track-nav-meta">{activeProject?.project.clientLabel ?? 'No client label'}</span>
              </span>
              <ChevronDown className="track-nav-icon track-project-chevron" size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="track-project-switcher-menu" side="right" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch project</DropdownMenuLabel>
                {projectItems.map((item) => (
                  <DropdownMenuItem
                    className={item.project._id === activeProjectId ? 'track-project-switcher-item active' : 'track-project-switcher-item'}
                    key={item.project._id}
                    onFocus={() => preloadProjectRoute(item.project._id)}
                    onClick={() => navigateToProject(item.project._id)}
                    onPointerEnter={() => preloadProjectRoute(item.project._id)}
                    onTouchStart={() => preloadProjectRoute(item.project._id)}
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
              <div className="track-nav-section">
                <span>Groups</span>
                <button
                  aria-label="Create group"
                  className="track-nav-action"
                  disabled={busyAction === 'create-group'}
                  onClick={handleCreateGroup}
                  title={navCollapsed ? 'Create group' : undefined}
                  type="button"
                >
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
              <div className="track-nav-list">
                {visibleGroups.map((group) => (
                  (() => {
                    const { Icon, tone } = getGroupAvatar(group)
                    return (
                      <Button
                        className={group._id === activeGroupId ? 'track-nav-item compact active' : 'track-nav-item compact'}
                        key={group._id}
                        onFocus={() => preloadGroupRoute(group._id)}
                        onClick={() => navigateToGroup(group._id)}
                        onPointerEnter={() => preloadGroupRoute(group._id)}
                        onTouchStart={() => preloadGroupRoute(group._id)}
                        title={navCollapsed ? group.name : undefined}
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
                className="track-nav-item"
                disabled={!activeProjectId}
                onClick={() => {
                  setMobileNavOpen(false)
                  setProjectSearchOpen(true)
                }}
                title={navCollapsed ? 'Search' : undefined}
                type="button"
              >
                <Search className="track-nav-icon" size={14} />
                <span className="track-nav-copy">
                  <span className="track-nav-title">Search</span>
                  <span className="track-nav-meta">Messages, records, files</span>
                </span>
              </Button>
              <Button
                className={view === 'records' ? 'track-nav-item active' : 'track-nav-item'}
                onFocus={preloadProjectRecordsRoute}
                onClick={navigateToProjectRecords}
                onPointerEnter={preloadProjectRecordsRoute}
                onTouchStart={preloadProjectRecordsRoute}
                title={navCollapsed ? `Records, ${projectRecords.length}` : undefined}
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
                onFocus={preloadProjectSettingsRoute}
                onClick={navigateToProjectSettings}
                onPointerEnter={preloadProjectSettingsRoute}
                onTouchStart={preloadProjectSettingsRoute}
                title={navCollapsed ? 'Settings' : undefined}
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
          {navCollapsed ? (
            <>
              <Button
                aria-expanded={logoutConfirmOpen}
                aria-label={`Account menu for ${currentUserName}`}
                className="track-nav-account-button"
                onClick={() => setLogoutConfirmOpen((isOpen) => !isOpen)}
                title={`${currentUserName} account`}
                type="button"
              >
                <Avatar className={`track-avatar ${getAvatarTone(currentUserEmail)}`}>
                  <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
                </Avatar>
              </Button>
              {logoutConfirmOpen ? (
                <div className="track-account-menu" role="dialog" aria-label="Account menu">
                  <div className="track-account-menu-user">
                    <strong>{currentUserName}</strong>
                    <span>{activeProject?.membership.role ?? 'owner'}</span>
                  </div>
                  <div className="track-account-menu-actions">
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
              ) : null}
            </>
          ) : (
            <AvatarNameTooltip
              detail={activeProject?.membership.role ?? 'owner'}
              name={currentUserName}
              side="right"
            >
              <Avatar className={`track-avatar ${getAvatarTone(currentUserEmail)}`}>
                <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
              </Avatar>
            </AvatarNameTooltip>
          )}
          <div className="track-nav-copy">
            <span className="track-nav-title">{currentUserName}</span>
            <span className="track-nav-meta">{activeProject?.membership.role ?? 'owner'}</span>
          </div>
          {!navCollapsed ? (
            <div className="track-nav-footer-actions">
              <ThemeToggle />
              <Button
                aria-expanded={logoutConfirmOpen}
                aria-label="Log out"
                className="track-nav-footer-button"
                onClick={() => setLogoutConfirmOpen((isOpen) => !isOpen)}
                title="Log out"
                type="button"
              >
                <LogOut size={14} />
              </Button>
              {logoutConfirmOpen ? (
                <div className="track-logout-confirm" role="dialog" aria-label="Confirm logout">
                  <p>Log out of Track?</p>
                  <div className="track-logout-confirm-actions">
                    <Button
                      className="track-button subtle"
                      onClick={() => setLogoutConfirmOpen(false)}
                      type="button"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="track-button track-button-primary"
                      onClick={() => void handleSignOut()}
                      type="button"
                    >
                      Log out
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
                  <AvatarNameTooltip
                    detail={item.membership.role.replaceAll('_', ' ')}
                    key={user._id}
                    name={user.displayName}
                  >
                    <Avatar className={`track-avatar ${getAvatarTone(user.email)}`}>
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                  </AvatarNameTooltip>
                )
              })}
              {extraHeaderMemberCount > 0 ? (
                <AvatarNameTooltip
                  detail={hiddenHeaderMembers
                    .map((item) => item.user?.displayName)
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(', ')}
                  name={`${extraHeaderMemberCount} more member${extraHeaderMemberCount === 1 ? '' : 's'}`}
                >
                  <span className="track-member-more">+{extraHeaderMemberCount}</span>
                </AvatarNameTooltip>
              ) : null}
            </div>
            {view === 'group' ? (
              <>
                <Button
                  aria-label="Search this chat"
                  className="icon-button"
                  onClick={() => {
                    setSearchOpen((open) => !open)
                    if (searchOpen) setChatSearchQuery('')
                  }}
                  title="Search this chat (/)"
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
              null
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
        {view === 'group' && searchOpen ? (
          <ChatSearchPopover
            activeIndex={activeChatMatchIndex}
            matchCount={chatSearchMatches.length}
            onClose={() => {
              setChatSearchQuery('')
              setSearchOpen(false)
              requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }))
            }}
            onNext={() => cycleChatSearchMatch(1)}
            onPrevious={() => cycleChatSearchMatch(-1)}
            onQueryChange={setChatSearchQuery}
            query={chatSearchQuery}
          />
        ) : null}

        {isProjectRouteLoading || isGroupRouteLoading ? (
          <WorkspaceRouteLoader label={view === 'group' ? 'Opening group conversation' : view === 'records' ? 'Loading project records' : view === 'settings' ? 'Loading project settings' : 'Loading project groups'} />
        ) : view === 'group' ? (
          <>
            <div
              className="track-thread-scroll"
              onScroll={handleThreadScroll}
              ref={threadScrollRef}
            >
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

                {chatSearchTerm && chatSearchMatches.length === 0 ? (
                  <div className="track-empty">
                    <p className="mono-label m-0">No matches</p>
                    <p>No chat items match "{chatSearchTerm}".</p>
                  </div>
                ) : null}

                {threadItems.map((threadItem, index) => {
                  const previousThreadItem = threadItems[index - 1]
                  const dayKey = getThreadDayKey(threadItem.at)
                  const shouldShowDaySeparator =
                    !previousThreadItem || getThreadDayKey(previousThreadItem.at) !== dayKey
                  const searchQuery = chatSearchMatchKeys.has(threadItem.key) ? chatSearchTerm : undefined
                  if (threadItem.kind === 'message') {
                    return (
                      <Fragment key={threadItem.key}>
                        {shouldShowDaySeparator ? (
                          <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                        ) : null}
                        <MessageRow
                          activeGroupId={activeGroupId}
                          busyAction={busyAction}
                          groups={visibleGroups}
                          isFlashing={flashingMessageId === threadItem.item.message._id}
                          item={{
                            ...threadItem.item,
                            authorRole:
                              projectMemberRoleByUserId.get(threadItem.item.author?._id ?? '') ??
                              threadItem.item.authorRole,
                          }}
                          mentionGroups={mentionGroups}
                          onForwardMessage={handleForwardMessage}
                          onOpenGroup={navigateToGroup}
                          onOpenMessageSource={handleOpenMessageSource}
                          onReplyMessage={handleReplyMessage}
                          searchQuery={searchQuery}
                        />
                      </Fragment>
                    )
                  }
                  if (threadItem.kind === 'assistant') {
                    return (
                      <Fragment key={threadItem.key}>
                        {shouldShowDaySeparator ? (
                          <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                        ) : null}
                        <AssistantAnswer
                          mentionGroups={mentionGroups}
                          messageCitations={messageCitations}
                          onOpenGroup={navigateToGroup}
                          onOpenMessageCitation={requestMessageFocus}
                          searchQuery={searchQuery}
                          stream={threadItem.stream}
                          threadItemKey={threadItem.key}
                        />
                      </Fragment>
                    )
                  }
                  return (
                    <Fragment key={threadItem.key}>
                      {shouldShowDaySeparator ? (
                        <ThreadDaySeparator label={formatThreadDayLabel(threadItem.at)} />
                      ) : null}
                      <DraftRecordCard
                        busy={busyAction === `classify-${threadItem.draft._id}`}
                        draft={threadItem.draft}
                        isSearchActive={chatSearchMatchKeys.has(threadItem.key)}
                        onClassify={handleClassifyDraft}
                        searchQuery={searchQuery}
                      />
                    </Fragment>
                  )
                })}
              </div>
              {showJumpToLatest ? (
                <Button
                  aria-label="Jump to latest message"
                  className="track-jump-latest"
                  onClick={() => scrollThreadToLatest()}
                  type="button"
                >
                  <ChevronDown aria-hidden="true" size={18} />
                </Button>
              ) : null}
            </div>

            <div className="track-composer-wrap">
              <TypingIndicatorLine indicators={activeTypingIndicators} />
              <div className={voiceRecordingActive ? 'track-composer recording' : 'track-composer'}>
                {!voiceRecordingActive && replyToMessage ? (
                  <div className="track-composer-quote" aria-label="Replying to message">
                    <CornerUpLeft size={14} />
                    <span>
                      <strong>Replying to {replyToMessage.author?.displayName ?? 'Unknown Member'}</strong>
                      <small>{replyToMessage.message.body || 'Attachment message'}</small>
                    </span>
                    <button
                      aria-label="Cancel reply"
                      onClick={() => setReplyToMessage(null)}
                      type="button"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : null}
                {!voiceRecordingActive && pendingAttachments.length > 0 ? (
                  <div className="track-composer-attachments" aria-label="Pending attachments">
                    {pendingAttachments.map((attachment) => (
                      <div
                        className={
                          attachment.kind === 'voice_note'
                            ? 'track-composer-attachment voice'
                            : 'track-composer-attachment'
                        }
                        key={attachment.id}
                      >
                        {attachment.kind === 'voice_note' && attachment.previewUrl ? (
                          <VoiceNoteReview
                            durationMs={attachment.durationMs}
                            file={attachment.file}
                            onRemove={() => removePendingAttachment(attachment.id)}
                            previewUrl={attachment.previewUrl}
                          />
                        ) : attachment.previewUrl ? (
                          <img alt="" src={attachment.previewUrl} />
                        ) : (
                          <span className="track-composer-file-icon">
                            <AttachmentTypeIcon
                              contentType={attachment.file.type}
                              filename={attachment.file.name}
                              size={18}
                            />
                          </span>
                        )}
                        {attachment.kind === 'voice_note' ? null : (
                          <>
                            <span className="track-composer-attachment-meta">
                              <strong>{attachment.file.name}</strong>
                              <small>
                                {isVoiceNoteAttachment({
                                  contentType: attachment.file.type,
                                  filename: attachment.file.name,
                                  kind: attachment.kind,
                                })
                                  ? formatVoiceDuration(attachment.durationMs)
                                  : formatFileSize(attachment.file.size)}
                              </small>
                            </span>
                            <button
                              aria-label={`Remove ${attachment.file.name}`}
                              className="track-composer-attachment-remove"
                              onClick={() => removePendingAttachment(attachment.id)}
                              type="button"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!voiceRecordingActive ? (
                  <Textarea
                    aria-label={`Message ${activeGroup?.name ?? 'Group'}`}
                    disabled={!activeGroupId || busyAction === 'send-message'}
                    onBlur={handleComposerBlur}
                    onChange={(event) => {
                      setComposer(event.currentTarget.value)
                      setComposerCursor(event.currentTarget.selectionStart)
                      setEmojiPickerOpen(false)
                    }}
                    onFocus={handleComposerFocus}
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
                    autoFocus
                    value={composer}
                  />
                ) : null}
                {!voiceRecordingActive && showMentionMenu ? (
                  <div className="track-mention-menu" role="listbox" aria-label="Mention someone">
                    {mentionSections.map((section) => (
                      <div className="track-mention-section" key={section.label}>
                        <p className="track-mention-section-label">{section.label}</p>
                        {section.options.map((option) => {
                          const index = filteredMentionOptions.findIndex((item) => item.id === option.id)
                          return (
                            <button
                              aria-selected={index === mentionIndex}
                              className={index === mentionIndex ? 'track-mention-option active' : 'track-mention-option'}
                              key={option.id}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                handleMentionSelect(option)
                              }}
                              ref={(element) => {
                                mentionOptionRefs.current[index] = element
                              }}
                              role="option"
                              type="button"
                            >
                              <Avatar className={option.tone === 'bot' ? 'track-mention-avatar bot' : `track-mention-avatar ${option.tone}`}>
                                <AvatarFallback>
                                  {option.kind === 'assistant' ? (
                                    <Bot size={13} />
                                  ) : option.kind === 'group' ? (
                                    <MessagesSquare size={13} />
                                  ) : (
                                    getInitials(option.label)
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span>
                                <strong>@{option.handle}</strong>
                                <small>{option.label} · {option.sublabel}</small>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!voiceRecordingActive && emojiPickerOpen ? (
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
                  {!voiceRecordingActive ? (
                    <Button
                      className="icon-button"
                      disabled={!activeGroupId || busyAction === 'send-message'}
                      onClick={() => fileInputRef.current?.click()}
                      title="Add attachment"
                      type="button"
                    >
                      <Paperclip size={15} />
                    </Button>
                  ) : null}
                  <VoiceRecorder
                    disabled={!activeGroupId || busyAction === 'send-message'}
                    onRecordingChange={setVoiceRecordingActive}
                    onRecorded={handleVoiceNoteRecorded}
                  />
                  {!voiceRecordingActive ? (
                    <>
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
                      <span className="track-composer-spacer" />
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
                    </>
                  ) : null}
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
                    <button
                      aria-label="AI review settings"
                      className="track-rail-icon-button"
                      disabled={!activeGroupId || busyAction === 'review-frequency'}
                      onClick={handleFrequencyChange}
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
                            onClick={() => void handleEnableBrowserNotifications()}
                          >
                            {notificationPermission === 'granted' ? 'Reconnect browser alerts' : 'Enable browser alerts'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={busyAction === 'notifications' || busyAction === 'test-notifications'}
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
      <ProjectSearchDialog
        filter={projectSearchFilter}
        loading={
          projectSearchOpen &&
          projectSearchQuery.trim().length >= 2 &&
          projectSearchResults === undefined
        }
        onClose={() => setProjectSearchOpen(false)}
        onFilterChange={setProjectSearchFilter}
        onOpenResult={handleProjectSearchResult}
        onQueryChange={setProjectSearchQuery}
        open={projectSearchOpen}
        projectName={activeProject?.project.name ?? 'Project'}
        query={projectSearchQuery}
        sections={projectSearchSections}
        total={projectSearchTotal}
      />
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
        reviewEnabledInput={reviewEnabledInput}
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
        setReviewEnabledInput={setReviewEnabledInput}
      />
    </main>
  )
}

function ChatSearchPopover({
  activeIndex,
  matchCount,
  onClose,
  onNext,
  onPrevious,
  onQueryChange,
  query,
}: {
  activeIndex: number
  matchCount: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onQueryChange: (query: string) => void
  query: string
}) {
  return (
    <div className="track-chat-search-popover" role="dialog" aria-label="Search this chat">
      <Search size={15} />
      <Input
        autoFocus
        className="track-chat-search-popover-input"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault()
            onNext()
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onPrevious()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
        placeholder="Search this chat..."
        value={query}
      />
      <span className="track-chat-search-count">
        {query.trim() ? `${matchCount ? activeIndex + 1 : 0}/${matchCount}` : '/'}
      </span>
      <Button
        aria-label="Previous chat search match"
        className="track-chat-search-step"
        disabled={matchCount === 0}
        onClick={onPrevious}
        type="button"
      >
        <ChevronUp size={13} />
      </Button>
      <Button
        aria-label="Next chat search match"
        className="track-chat-search-step"
        disabled={matchCount === 0}
        onClick={onNext}
        type="button"
      >
        <ChevronDown size={13} />
      </Button>
      <Button
        aria-label="Close chat search"
        className="track-chat-search-step"
        onClick={onClose}
        type="button"
      >
        <X size={13} />
      </Button>
    </div>
  )
}

function ProjectSearchDialog({
  filter,
  loading,
  onClose,
  onFilterChange,
  onOpenResult,
  onQueryChange,
  open,
  projectName,
  query,
  sections,
  total,
}: {
  filter: ProjectSearchFilter
  loading: boolean
  onClose: () => void
  onFilterChange: (filter: ProjectSearchFilter) => void
  onOpenResult: (result: ProjectSearchResult) => void
  onQueryChange: (query: string) => void
  open: boolean
  projectName: string
  query: string
  sections: Array<{ key: string; label: string; results: ProjectSearchResult[] }>
  total: number
}) {
  const resultButtonsRef = useRef<Array<HTMLButtonElement | null>>([])
  const flatResults = useMemo(
    () => sections.flatMap((section) => section.results),
    [sections],
  )
  const [activeResultIndex, setActiveResultIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveResultIndex((index) =>
          flatResults.length > 0 ? (index + 1) % flatResults.length : 0,
        )
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveResultIndex((index) =>
          flatResults.length > 0 ? (index - 1 + flatResults.length) % flatResults.length : 0,
        )
        return
      }
      if (event.key === 'Enter' && flatResults[activeResultIndex]) {
        event.preventDefault()
        onOpenResult(flatResults[activeResultIndex])
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [activeResultIndex, flatResults, onClose, onOpenResult, open])

  useEffect(() => {
    setActiveResultIndex(0)
  }, [filter, query])

  useEffect(() => {
    if (activeResultIndex < flatResults.length) return
    setActiveResultIndex(Math.max(flatResults.length - 1, 0))
  }, [activeResultIndex, flatResults.length])

  useEffect(() => {
    resultButtonsRef.current[activeResultIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeResultIndex])

  if (!open) return null

  const filters: Array<{ Icon: typeof Search; label: string; value: ProjectSearchFilter }> = [
    { Icon: Search, label: 'All', value: 'all' },
    { Icon: MessagesSquare, label: 'Messages', value: 'messages' },
    { Icon: FileCheck2, label: 'Records', value: 'records' },
    { Icon: Paperclip, label: 'Files', value: 'files' },
    { Icon: FolderKanban, label: 'Groups', value: 'groups' },
  ]
  const hasQuery = query.trim().length >= 2
  let resultIndex = -1

  return (
    <div className="track-project-search-overlay" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Project search"
        aria-modal="true"
        className="track-project-search"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="track-project-search-header">
          <div>
            <span className="mono-label">Current project search</span>
            <h2>{projectName}</h2>
          </div>
          <Button aria-label="Close project search" className="icon-button" onClick={onClose} type="button">
            <X size={15} />
          </Button>
        </header>
        <div className="track-project-search-box">
          <Search size={16} />
          <Input
            autoFocus
            className="track-project-search-input"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search messages, records, files, and groups..."
            value={query}
          />
          <span>{total} results</span>
        </div>
        <div className="track-project-search-filters" role="list" aria-label="Search filters">
          {filters.map((item) => (
            <button
              className={filter === item.value ? 'active' : ''}
              key={item.value}
              onClick={() => onFilterChange(item.value)}
              title={item.label}
              type="button"
            >
              <item.Icon size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="track-project-search-results" role={total > 0 ? 'listbox' : undefined}>
          {!hasQuery ? (
            <div className="track-project-search-state">
              <Search size={18} />
              <p>Type at least 2 characters to search this project.</p>
              <small>Use ⌘K anywhere, or / inside a group when the composer is not focused.</small>
            </div>
          ) : loading ? (
            <div className="track-project-search-state">
              <LoaderCircle className="spin" size={18} />
              <p>Searching project...</p>
            </div>
          ) : total === 0 ? (
            <div className="track-project-search-state">
              <Search size={18} />
              <p>No results for "{query.trim()}".</p>
            </div>
          ) : (
            sections.map((section) =>
              section.results.length > 0 ? (
                <div className="track-project-search-section" key={section.key}>
                  <p className="track-project-search-section-label">{section.label}</p>
                  {section.results.map((result) => {
                    resultIndex += 1
                    const currentResultIndex = resultIndex
                    const isActive = currentResultIndex === activeResultIndex
                    return (
                      <button
                        aria-selected={isActive}
                        className={isActive ? 'track-project-search-result active' : 'track-project-search-result'}
                        key={`${result.kind}-${result.id}`}
                        onClick={() => onOpenResult(result)}
                        ref={(element) => {
                          resultButtonsRef.current[currentResultIndex] = element
                        }}
                        role="option"
                        type="button"
                      >
                        <span className={`track-project-search-icon ${result.kind}`}>
                          {result.kind === 'file' ? (
                            <AttachmentTypeIcon
                              contentType={result.contentType ?? 'application/octet-stream'}
                              filename={result.title}
                              size={16}
                            />
                          ) : result.kind === 'record' ? (
                            <FileCheck2 size={16} />
                          ) : result.kind === 'group' ? (
                            <FolderKanban size={16} />
                          ) : (
                            <MessagesSquare size={16} />
                          )}
                        </span>
                        <span className="track-project-search-copy">
                          <strong>{result.title}</strong>
                          <small>{result.subtitle}</small>
                          <span>{result.preview}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
      </section>
    </div>
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

function ThreadDaySeparator({ label }: { label: string }) {
  return (
    <div className="track-thread-day-separator" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}

function TrackLoading({ label }: { label: string }) {
  return <TrackLoader label={label} />
}

function WorkspaceRouteLoader({ label }: { label: string }) {
  return (
    <div className="track-route-loader" role="status" aria-live="polite">
      <LoaderCircle className="track-route-loader-icon" size={18} />
      <span>{label}</span>
    </div>
  )
}
