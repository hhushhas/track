import { Navigate, useNavigate, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { getActiveMention } from '#/features/workspace/identity'
import {
  buildComposerPlaceholder,
  buildMentionGroups,
  buildMentionSections,
  buildWorkspaceMentionOptions,
  filterMentionOptions,
} from '#/features/workspace/lib/mentions'
import type { GroupMessageItem } from '#/features/workspace/thread-items'
import { WorkspaceDialogs } from '#/features/workspace/workspace-dialogs'
import { GroupChatPage } from '#/features/workspace/components/GroupChatPage'
import { StepUpVerificationDialog } from '#/features/workspace/components/StepUpVerificationDialog'
import { WorkspaceHeader } from '#/features/workspace/components/WorkspaceHeader'
import { WorkspaceRail } from '#/features/workspace/components/WorkspaceRail'
import { WorkspaceSidebar } from '#/features/workspace/components/WorkspaceSidebar'
import { TrackLoading, WorkspaceRouteLoader } from '#/features/workspace/components/loaders'
import { usePendingAttachments } from '#/features/workspace/hooks/usePendingAttachments'
import { useWorkspaceDialogActions } from '#/features/workspace/hooks/useWorkspaceDialogActions'
import { useWorkspaceData } from '#/features/workspace/hooks/useWorkspaceData'
import { useProjectRecordExport } from '#/features/workspace/hooks/useProjectRecordExport'
import { useWorkspaceDialogState } from '#/features/workspace/hooks/useWorkspaceDialogState'
import { useWorkspaceMessageActions } from '#/features/workspace/hooks/useWorkspaceMessageActions'
import { useWorkspaceNotifications } from '#/features/workspace/hooks/useWorkspaceNotifications'
import { useWorkspaceRecordActions } from '#/features/workspace/hooks/useWorkspaceRecordActions'
import { useWorkspaceTypingIndicators } from '#/features/workspace/hooks/useWorkspaceTypingIndicators'
import { findVisibleRouteGroupId } from '#/features/workspace/lib/route-state'
import { ProjectRecordsPage } from '#/features/workspace/records/ProjectRecordsPage'
import type { ProjectRecordFilter } from '#/features/workspace/records/filtering'
import { ChatSearchPopover } from '#/features/workspace/search/ChatSearchPopover'
import { buildChatSearchMatches } from '#/features/workspace/search/chat-search'
import { buildMessageCitations, buildWorkspaceThreadItems } from '#/features/workspace/search/chat-thread-data'
import { ProjectSearchDialog } from '#/features/workspace/search/ProjectSearchDialog'
import type { ProjectSearchFilter, ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'
import { buildProjectSearchSections, getProjectSearchTotal } from '#/features/workspace/search/project-search-sections'
import { ProjectSettingsPage } from '#/features/workspace/settings/ProjectSettingsPage'
import { authClient } from '#/lib/auth-client'
import { disableDevAuthBypass, useDevAuthBypass } from '#/lib/dev-auth-bypass'
import { useOAuthCallbackPending } from '#/lib/oauth-callback'

type WorkspacePageProps = {
  groupId?: string
  projectId?: string
  view?: 'home' | 'project' | 'group' | 'records' | 'settings'
}

const resolvedTrackUserIds = new Map<string, Id<'users'>>()

function clearResolvedTrackUserIds() {
  resolvedTrackUserIds.clear()
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

export function WorkspacePage({ groupId, projectId, view = 'home' }: WorkspacePageProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const session = authClient.useSession()
  const syncCurrentUser = useMutation(api.auth.syncGoogleUser)
  const syncDevUser = useMutation(api.auth.syncDevUser)
  const ensureStarterProject = useMutation(api.projects.ensureStarter)
  const acceptPendingInvitations = useMutation(api.invitations.acceptPendingForCurrentUser)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(() => {
    const sessionUser = getSessionUser(authClient.getSessionData?.())
    return sessionUser ? resolvedTrackUserIds.get(sessionUser.id) ?? null : null
  })
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null)
  const [composer, setComposer] = useState('')
  const [replyToMessage, setReplyToMessage] = useState<GroupMessageItem | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const [composerCursor, setComposerCursor] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [activeChatMatchIndex, setActiveChatMatchIndex] = useState(0)
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [projectSearchFilter, setProjectSearchFilter] = useState<ProjectSearchFilter>('all')
  const [recordSearchQuery, setRecordSearchQuery] = useState('')
  const [recordFilter, setRecordFilter] = useState<ProjectRecordFilter>('all')
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const mentionOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const shouldFollowLatestRef = useRef(true)
  const lastLoadedGroupIdRef = useRef<Id<'groups'> | null>(null)
  const flashMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    clearPendingAttachments,
    handleComposerPaste,
    handleFileSelected,
    handleVoiceNoteRecorded,
    pendingAttachments,
    removePendingAttachment,
  } = usePendingAttachments({
    activeGroupId,
    composerRef,
    onAfterAdd: () => setEmojiPickerOpen(false),
  })

  useEffect(() => {
    return () => {
      if (flashMessageTimeoutRef.current) {
        clearTimeout(flashMessageTimeoutRef.current)
      }
    }
  }, [])

  const routeProjectId = projectId as Id<'projects'> | undefined
  const routeGroupId = groupId as Id<'groups'> | undefined
  const devAuthBypass = useDevAuthBypass()
  const sessionUser = useMemo(
    () => getSessionUser(session.data ?? devAuthBypass.sessionData),
    [devAuthBypass.sessionData, session.data],
  )
  const hasSessionAccess = Boolean(session.data || devAuthBypass.enabled)
  const oauthCallbackPending = useOAuthCallbackPending(hasSessionAccess)
  const {
    activeGroup,
    activeProject,
    activeProjectMembers,
    confirmedActiveGroupId,
    currentAvatarUrl,
    currentTrackProfileIncomplete,
    currentTrackUser,
    drafts,
    filteredProjectRecords,
    groupAssistantStreams,
    groupDrafts,
    groupMessages,
    groups,
    latestReview,
    messages,
    projectAuditEvents,
    projectInvitations,
    projectItems,
    projectMemberRoleByUserId,
    projectMembers,
    projectRecords,
    projectSearchResults,
    projects,
    visibleGroups,
  } = useWorkspaceData({
    activeGroupId,
    activeProjectId,
    projectSearchFilter,
    projectSearchOpen,
    projectSearchQuery,
    recordFilter,
    recordSearchQuery,
    trackUserId,
  })
  const mentionOptions = useMemo(
    () => buildWorkspaceMentionOptions(activeProjectMembers, visibleGroups),
    [activeProjectMembers, visibleGroups],
  )
  const mentionGroups = useMemo(
    () => buildMentionGroups(activeProjectMembers, visibleGroups),
    [activeProjectMembers, visibleGroups],
  )
  const activeMention = useMemo(
    () => getActiveMention(composer, composerCursor),
    [composer, composerCursor],
  )
  const filteredMentionOptions = useMemo(
    () => (activeMention ? filterMentionOptions(mentionOptions, activeMention.query) : []),
    [activeMention, mentionOptions],
  )
  const mentionSections = useMemo(
    () => buildMentionSections(filteredMentionOptions),
    [filteredMentionOptions],
  )
  const showMentionMenu = activeMention !== null && filteredMentionOptions.length > 0
  const composerHasTypingText = composer.trim().length > 0
  const {
    activeTypingIndicators,
    setComposerFocused,
  } = useWorkspaceTypingIndicators({
    activeGroupId,
    activeProjectId,
    composerHasTypingText,
    pendingAttachmentCount: pendingAttachments.length,
    queryGroupId: confirmedActiveGroupId,
    trackUserId,
    view,
    voiceRecordingActive,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('track-nav-collapsed', String(navCollapsed))
  }, [navCollapsed])

  useEffect(() => {
    setLogoutConfirmOpen(false)
  }, [navCollapsed])

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
    setReplyToMessage(null)
  }, [activeGroupId])

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
    if (!sessionUser?.id) {
      setTrackUserId(null)
      return
    }
    const cachedTrackUserId = resolvedTrackUserIds.get(sessionUser.id)
    if (cachedTrackUserId) {
      if (trackUserId !== cachedTrackUserId) setTrackUserId(cachedTrackUserId)
      return
    }
    if (trackUserId) return
    if (devAuthBypass.enabled && !session.data) {
      void syncDevUser()
        .then(async (userId) => {
          resolvedTrackUserIds.set(sessionUser.id, userId)
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
        resolvedTrackUserIds.set(sessionUser.id, userId)
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
    if (currentTrackProfileIncomplete) return
    void ensureStarterProject({ userId: trackUserId })
      .then((starterProjectId) => {
        setActiveProjectId(starterProjectId)
        void navigate({
          to: '/workspace/projects/$projectId',
          params: { projectId: starterProjectId },
        })
      })
      .catch(setActionError)
  }, [currentTrackProfileIncomplete, ensureStarterProject, navigate, projectItems.length, projects, trackUserId])

  useEffect(() => {
    if (!trackUserId || currentTrackUser === undefined || !currentTrackProfileIncomplete) return
    const next = `${window.location.pathname}${window.location.search}`
    window.location.href = `/onboarding/profile?next=${encodeURIComponent(next)}`
  }, [currentTrackProfileIncomplete, currentTrackUser, trackUserId])

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
    if (routeProjectId && activeProjectId !== routeProjectId) return
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
    if (routeProjectId && activeProjectId !== routeProjectId) return
    if (view !== 'project' || groups === undefined || !activeProjectId || !firstGroupId) return
    void navigate({
      to: '/workspace/projects/$projectId/groups/$groupId',
      params: { groupId: firstGroupId, projectId: activeProjectId },
    })
  }, [activeProjectId, groups, navigate, view, visibleGroups])

  const dialogState = useWorkspaceDialogState({ activeGroup, activeGroupId })
  const {
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
  } = dialogState
  const currentUserName = currentTrackUser?.displayName ?? sessionUser?.name ?? 'Track User'
  const currentUserEmail = currentTrackUser?.email ?? sessionUser?.email ?? currentUserName
  const currentUserDesignation = currentTrackUser?.profileDesignation ?? activeProject?.membership.role ?? 'owner'
  const {
    exportBusyAction,
    exportDownloadUrl,
    handleRequestExport,
    latestExportId,
    stepUpDialogOpen,
    stepUpDialogProps,
  } = useProjectRecordExport({
    activeProjectId,
    currentTrackUser,
    trackUserId,
    onError: setActionError,
  })
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
      buildWorkspaceThreadItems({
        assistantStreams: groupAssistantStreams,
        draftRecords: pendingDrafts,
        messages: visibleMessages,
      }),
    [groupAssistantStreams, pendingDrafts, visibleMessages],
  )
  const chatSearchTerm = chatSearchQuery.trim()
  const chatSearchMatches = useMemo(
    () => buildChatSearchMatches(threadItems, chatSearchTerm),
    [chatSearchTerm, threadItems],
  )
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
  const headerMemberAvatarUrls = useQuery(
    api.auth.getAvatarUrls,
    headerMembers.length
      ? { userIds: headerMembers.map((item) => (item.user as Doc<'users'>)._id) }
      : 'skip',
  )
  const headerMemberAvatarUrlById = useMemo(() => {
    const urls = new Map<string, string>()
    for (const item of headerMemberAvatarUrls ?? []) {
      if (item.url) urls.set(item.userId, item.url)
    }
    return urls
  }, [headerMemberAvatarUrls])
  const messageAuthorIds = useMemo(
    () => Array.from(new Set(visibleMessages.flatMap((item) => item.author ? [item.author._id] : []))),
    [visibleMessages],
  )
  const messageAuthorAvatarUrls = useQuery(
    api.auth.getAvatarUrls,
    messageAuthorIds.length ? { userIds: messageAuthorIds } : 'skip',
  )
  const messageAuthorAvatarUrlById = useMemo(() => {
    const urls = new Map<string, string>()
    for (const item of messageAuthorAvatarUrls ?? []) {
      if (item.url) urls.set(item.userId, item.url)
    }
    return urls
  }, [messageAuthorAvatarUrls])
  const hiddenHeaderMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(headerMembers.length),
    [activeProjectMembers, headerMembers.length],
  )
  const extraHeaderMemberCount = Math.max(activeProjectMembers.filter((item) => item.user).length - headerMembers.length, 0)
  const composerPlaceholder = buildComposerPlaceholder({
    activeGroupName: activeGroup?.name,
    activeProjectMembers,
  })
  const messageCitations = useMemo(() => buildMessageCitations(visibleMessages), [visibleMessages])
  const projectSearchSections = useMemo(
    () => buildProjectSearchSections(projectSearchResults),
    [projectSearchResults],
  )
  const projectSearchTotal = getProjectSearchTotal(projectSearchSections)
  const activeProjectRole = activeProject?.membership.role
  const canManageProject = activeProjectRole === 'owner' || activeProjectRole === 'admin'
  const canDeleteProject = activeProjectRole === 'owner'
  const {
    globalNotificationMode,
    groupNotificationMode,
    groupNotificationSettings,
    notificationBusyAction,
    notificationPermission,
    notificationStatus,
    handleEnableBrowserNotifications,
    handleNotificationMode,
    handleSendTestNotification,
  } = useWorkspaceNotifications({
    activeGroup,
    activeGroupId,
    activeProject,
    messagesLoaded: messages !== undefined,
    trackUserId,
    visibleMessages,
  })
  const {
    handleDeleteGroup,
    handleDeleteProject,
    handleCreateGroupSubmit,
    handleCreateProjectSubmit,
    handleFrequencySubmit,
    handleInviteSubmit,
  } = useWorkspaceDialogActions({
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
    onBusyChange: setBusyAction,
    onClearError: () => setUiError(null),
    onError: setActionError,
    onFrequencyDialogOpenChange: setFrequencyDialogOpen,
    onGroupCreated: (groupIdToOpen) => {
      if (!activeProjectId) return
      setActiveGroupId(groupIdToOpen)
      void navigate({
        to: '/workspace/projects/$projectId/groups/$groupId',
        params: { groupId: groupIdToOpen, projectId: activeProjectId },
      })
    },
    onGroupDeleted: (deletedGroupId) => {
      if (activeGroupId === deletedGroupId) {
        setActiveGroupId(null)
        navigateToProjectSettings()
      }
    },
    onGroupDialogOpenChange: setGroupDialogOpen,
    onGroupUpdated: () => undefined,
    onInviteDialogOpenChange: setInviteDialogOpen,
    onProjectDeleted: (deletedProjectId) => {
      setActiveProjectId(null)
      setActiveGroupId(null)
      const nextProject = projectItems.find((item) => item.project._id !== deletedProjectId)
      if (nextProject) {
        navigateToProject(nextProject.project._id)
        return
      }
      void navigate({ to: '/workspace' })
    },
    onProjectCreated: (projectIdToOpen) => {
      setActiveGroupId(null)
      navigateToProject(projectIdToOpen)
    },
    onProjectDialogOpenChange: setProjectDialogOpen,
    onProjectUpdated: () => undefined,
    projectClientLabel,
    projectDialogMode,
    projectName,
    reviewEnabledInput,
    trackUserId,
  })
  const {
    handleClassifyDraft,
    handleRecordStatus,
  } = useWorkspaceRecordActions({
    activeGroupId,
    activeProjectId,
    onBusyChange: setBusyAction,
    onClearError: () => setUiError(null),
    onError: setActionError,
    trackUserId,
  })
  const {
    handleForwardMessage,
    handleSendMessage,
  } = useWorkspaceMessageActions({
    activeGroupId,
    activeProjectId,
    composer,
    mentionOptions,
    onAfterSend: handleMessageSent,
    onBusyChange: setBusyAction,
    onClearError: () => setUiError(null),
    onError: setActionError,
    pendingAttachments,
    replyToMessage,
    trackUserId,
  })

  if (oauthCallbackPending) return <TrackLoading label="Finishing Google sign-in" />
  if (session.isPending && !devAuthBypass.enabled) return <TrackLoading label="Checking your session" />
  if (!hasSessionAccess) return <Navigate to="/sign-in" />
  if (!sessionUser) return <Navigate to="/sign-in" />
  if (!trackUserId && uiError) return <TrackLoading label={uiError} />
  if (!trackUserId) return <TrackLoading label="Connecting your project session" />

  function setActionError(error: unknown) {
    setUiError(error instanceof Error ? error.message : 'Something went wrong')
  }

  function handleMessageSent() {
    setComposer('')
    setComposerCursor(0)
    setReplyToMessage(null)
    clearPendingAttachments()
    shouldFollowLatestRef.current = true
    requestThreadScrollToLatest('smooth')
    requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true })
    })
  }

  function handleReplyMessage(item: GroupMessageItem) {
    if (item.message.groupId !== activeGroupId) return
    setReplyToMessage(item)
    requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }))
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

  function handleMentionSelect(option: { handle: string }) {
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

  function navigateToProject(projectIdToOpen: Id<'projects'>) {
    setMobileNavOpen(false)
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
    clearResolvedTrackUserIds()
    setTrackUserId(null)
    setActiveProjectId(null)
    setActiveGroupId(null)
    await authClient.signOut()
    await navigate({ replace: true, to: '/sign-in' })
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
      <WorkspaceSidebar
        activeGroupId={activeGroupId}
        activeProject={activeProject}
        activeProjectId={activeProjectId}
        busyAction={busyAction}
        currentAvatarUrl={currentAvatarUrl}
        currentUserBannerStyle={currentTrackUser?.profileBannerStyle}
        currentUserDesignation={currentUserDesignation}
        currentUserEmail={currentUserEmail}
        currentUserName={currentUserName}
        logoutConfirmOpen={logoutConfirmOpen}
        mobileNavOpen={mobileNavOpen}
        navCollapsed={navCollapsed}
        onCreateGroup={openGroupDialog}
        onCreateProject={openProjectDialog}
        onLogoutConfirmOpenChange={setLogoutConfirmOpen}
        onMobileNavOpenChange={setMobileNavOpen}
        onNavigateProjectRecords={navigateToProjectRecords}
        onNavigateProjectSettings={navigateToProjectSettings}
        onNavCollapsedChange={setNavCollapsed}
        onOpenProjectSearch={() => {
          setMobileNavOpen(false)
          setProjectSearchOpen(true)
        }}
        onPreloadGroupRoute={preloadGroupRoute}
        onPreloadProjectRecordsRoute={preloadProjectRecordsRoute}
        onPreloadProjectRoute={preloadProjectRoute}
        onPreloadProjectSettingsRoute={preloadProjectSettingsRoute}
        onSelectGroup={navigateToGroup}
        onSelectProject={navigateToProject}
        onSignOut={() => void handleSignOut()}
        projectItems={projectItems}
        projectRecordsCount={projectRecords.length}
        view={view}
        visibleGroups={visibleGroups}
      />

      <section className="track-workspace">
        <WorkspaceHeader
          activeGroup={activeGroup}
          activeProject={activeProject}
          activeProjectId={activeProjectId}
          busyAction={busyAction}
          extraHeaderMemberCount={extraHeaderMemberCount}
          fileInputRef={fileInputRef}
          headerMemberAvatarUrlById={headerMemberAvatarUrlById}
          headerMembers={headerMembers}
          hiddenHeaderMembers={hiddenHeaderMembers}
          onCreateGroup={openGroupDialog}
          onFileSelected={(event) => void handleFileSelected(event)}
          onInvite={openInviteDialog}
          onMobileNavOpen={() => setMobileNavOpen(true)}
          onSearchToggle={() => {
            setSearchOpen((open) => !open)
            if (searchOpen) setChatSearchQuery('')
          }}
          view={view}
        />

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
          <GroupChatPage
            activeGroup={activeGroup}
            activeGroupId={activeGroupId}
            activeTypingIndicators={activeTypingIndicators}
            busyAction={busyAction}
            chatSearchMatchKeys={chatSearchMatchKeys}
            chatSearchMatches={chatSearchMatches}
            chatSearchTerm={chatSearchTerm}
            composer={composer}
            composerPlaceholder={composerPlaceholder}
            composerRef={composerRef}
            emojiGroups={emojiGroups}
            emojiPickerOpen={emojiPickerOpen}
            fileInputRef={fileInputRef}
            filteredMentionOptions={filteredMentionOptions}
            flashingMessageId={flashingMessageId}
            mentionGroups={mentionGroups}
            mentionIndex={mentionIndex}
            mentionOptionRefs={mentionOptionRefs}
            mentionSections={mentionSections}
            messageAuthorAvatarUrlById={messageAuthorAvatarUrlById}
            messageCitations={messageCitations}
            messagesLoaded={messages !== undefined}
            onClassifyDraft={handleClassifyDraft}
            onComposerBlur={handleComposerBlur}
            onComposerChange={(value, cursor) => {
              setComposer(value)
              setComposerCursor(cursor)
            }}
            onComposerFocus={handleComposerFocus}
            onComposerKeyUp={handleComposerSelection}
            onComposerPaste={handleComposerPaste}
            onComposerSelect={handleComposerSelection}
            onEmojiPickerOpenChange={setEmojiPickerOpen}
            onForwardMessage={handleForwardMessage}
            onInsertComposerText={insertComposerText}
            onMentionIndexChange={setMentionIndex}
            onMentionSelect={handleMentionSelect}
            onOpenGroup={navigateToGroup}
            onOpenMessageCitation={requestMessageFocus}
            onOpenMessageSource={handleOpenMessageSource}
            onRecordingChange={setVoiceRecordingActive}
            onReplyMessage={handleReplyMessage}
            onReplyToMessageChange={setReplyToMessage}
            onSendMessage={() => void handleSendMessage()}
            onShowMentionMenuClose={() => setComposerCursor(0)}
            onThreadScroll={handleThreadScroll}
            onVoiceNoteRecorded={handleVoiceNoteRecorded}
            pendingAttachments={pendingAttachments}
            projectMemberRoleByUserId={projectMemberRoleByUserId}
            removePendingAttachment={removePendingAttachment}
            replyToMessage={replyToMessage}
            scrollThreadToLatest={scrollThreadToLatest}
            setComposerCursorFromRef={() => setComposerCursor(composerRef.current?.selectionStart ?? composerCursor)}
            showJumpToLatest={showJumpToLatest}
            showMentionMenu={showMentionMenu}
            threadItems={threadItems}
            threadScrollRef={threadScrollRef}
            visibleGroups={visibleGroups}
            visibleMessages={visibleMessages}
            voiceRecordingActive={voiceRecordingActive}
          />
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
            busyAction={busyAction}
            canDeleteProject={canDeleteProject}
            canManageProject={canManageProject}
            globalNotificationMode={globalNotificationMode}
            groupNotificationSettings={groupNotificationSettings}
            groups={visibleGroups}
            members={activeProjectMembers}
            onDeleteGroup={(groupIdToDelete) => void handleDeleteGroup(groupIdToDelete)}
            onDeleteProject={() => void handleDeleteProject()}
            onEditGroup={openEditGroupDialog}
            onEditProject={openEditProjectDialog}
            onInvite={openInviteDialog}
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
        <WorkspaceRail
          activeGroupId={activeGroupId}
          activeProjectId={activeProjectId}
          busyAction={exportBusyAction ?? notificationBusyAction ?? busyAction}
          exportDownloadUrl={exportDownloadUrl}
          globalNotificationMode={globalNotificationMode}
          groupNotificationMode={groupNotificationMode}
          latestExportId={latestExportId}
          latestReview={latestReview}
          notificationPermission={notificationPermission}
          notificationStatus={notificationStatus}
          onCollapse={() => setRailCollapsed(true)}
          onEnableBrowserNotifications={() => void handleEnableBrowserNotifications()}
          onExpand={() => setRailCollapsed(false)}
          onFrequencyChange={openFrequencyDialog}
          onNotificationMode={(mode) => void handleNotificationMode(mode)}
          onRecordStatus={handleRecordStatus}
          onRequestExport={(format) => void handleRequestExport(format)}
          onSendTestNotification={() => void handleSendTestNotification()}
          onStartResize={() => setRailResizing(true)}
          pendingDraftCount={pendingDrafts.length}
          projectAuditEvents={projectAuditEvents}
          projectInvitations={projectInvitations}
          projectRecords={projectRecords}
          railCollapsed={railCollapsed}
        />
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
      {stepUpDialogOpen ? <StepUpVerificationDialog {...stepUpDialogProps} /> : null}
      <WorkspaceDialogs
        activeGroupId={activeGroupId}
        busyAction={busyAction}
        frequencyDialogOpen={frequencyDialogOpen}
        frequencyMinutesInput={frequencyMinutesInput}
        groupDialogOpen={groupDialogOpen}
        groupDialogMode={groupDialogMode}
        groupName={groupName}
        inviteCanReview={inviteCanReview}
        inviteDialogOpen={inviteDialogOpen}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteAccess={inviteAccess}
        onCreateGroupSubmit={handleCreateGroupSubmit}
        onCreateProjectSubmit={handleCreateProjectSubmit}
        onFrequencySubmit={handleFrequencySubmit}
        onInviteSubmit={handleInviteSubmit}
        projectClientLabel={projectClientLabel}
        projectDialogOpen={projectDialogOpen}
        projectDialogMode={projectDialogMode}
        projectName={projectName}
        projectGroups={visibleGroups}
        reviewEnabledInput={reviewEnabledInput}
        setFrequencyDialogOpen={setFrequencyDialogOpen}
        setFrequencyMinutesInput={setFrequencyMinutesInput}
        setGroupDialogOpen={setGroupDialogOpen}
        setGroupName={setGroupName}
        setInviteCanReview={setInviteCanReview}
        setInviteDialogOpen={setInviteDialogOpen}
        setInviteEmail={setInviteEmail}
        setInviteRole={setInviteRole}
        setInviteAccess={setInviteAccess}
        setProjectClientLabel={setProjectClientLabel}
        setProjectDialogOpen={setProjectDialogOpen}
        setProjectName={setProjectName}
        setReviewEnabledInput={setReviewEnabledInput}
      />
    </main>
  )
}
