import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  TYPING_INDICATOR_HEARTBEAT_MS,
  filterActiveTypingIndicators,
} from '#/features/workspace/typing-indicators'

function ignoreTypingIndicatorError() {
  return undefined
}

export function useWorkspaceTypingIndicators({
  activeGroupId,
  activeProjectId,
  composerHasTypingText,
  pendingAttachmentCount,
  queryGroupId,
  trackUserId,
  view,
  voiceRecordingActive,
}: {
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  composerHasTypingText: boolean
  pendingAttachmentCount: number
  queryGroupId: Id<'groups'> | null
  trackUserId: Id<'users'> | null
  view: 'home' | 'project' | 'group' | 'records' | 'settings'
  voiceRecordingActive: boolean
}) {
  const heartbeatTypingIndicator = useMutation(api.typingIndicators.heartbeat)
  const clearTypingIndicator = useMutation(api.typingIndicators.clear)
  const [composerFocused, setComposerFocused] = useState(false)
  const [typingNow, setTypingNow] = useState(() => Date.now())
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  const typingIndicators = useQuery(
    api.typingIndicators.list,
    trackUserId && queryGroupId
      ? {
          groupId: queryGroupId,
          userId: trackUserId,
        }
      : 'skip',
  )

  const composingActivity = useMemo<'typing' | 'attaching' | 'recording' | null>(() => {
    if (voiceRecordingActive) return 'recording' as const
    if (composerFocused && composerHasTypingText) return 'typing' as const
    if (pendingAttachmentCount > 0) return 'attaching' as const
    return null
  }, [composerFocused, composerHasTypingText, pendingAttachmentCount, voiceRecordingActive])

  const activeTypingIndicators = useMemo(
    () => filterActiveTypingIndicators(typingIndicators ?? [], typingNow),
    [typingIndicators, typingNow],
  )

  useEffect(() => {
    if (view !== 'group' || !activeGroupId) return
    setTypingNow(Date.now())
    const intervalId = window.setInterval(() => {
      setTypingNow(Date.now())
    }, TYPING_INDICATOR_HEARTBEAT_MS)
    return () => window.clearInterval(intervalId)
  }, [activeGroupId, view])

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

  return {
    activeTypingIndicators,
    setComposerFocused,
  }
}
