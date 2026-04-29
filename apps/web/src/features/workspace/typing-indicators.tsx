import type { Doc } from '../../../../../convex/_generated/dataModel'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { getAvatarTone, getInitials } from './identity'

const MAX_VISIBLE_NAMES = 2
const MAX_VISIBLE_AVATARS = 3
export const TYPING_INDICATOR_HEARTBEAT_MS = 2_000
export const TYPING_INDICATOR_VISIBLE_MS = 6_000
const TYPING_INDICATOR_EXIT_MS = 180

type TypingIndicatorItem = {
  indicator: Doc<'typingIndicators'>
  user: Doc<'users'> | null
}

export function filterActiveTypingIndicators(indicators: TypingIndicatorItem[], now: number) {
  const visibleSince = now - TYPING_INDICATOR_VISIBLE_MS
  return indicators
    .filter((item) => item.indicator.updatedAt >= visibleSince)
    .sort((a, b) => b.indicator.updatedAt - a.indicator.updatedAt)
}

function getIndicatorActivity(item: TypingIndicatorItem) {
  return item.indicator.activity ?? 'typing'
}

function normalizeActivity(activity: string | undefined) {
  if (activity === 'attaching') return 'attaching' as const
  if (activity === 'recording') return 'recording' as const
  return 'typing' as const
}

function getActivityCopy(activity: ReturnType<typeof getIndicatorActivity>, plural: boolean) {
  if (activity === 'attaching') return plural ? 'are adding attachments' : 'is adding an attachment'
  if (activity === 'recording') return plural ? 'are recording voice notes' : 'is recording a voice note'
  return plural ? 'are typing' : 'is typing'
}

function formatNames(names: string[]) {
  const visibleNames = names.map((name) => name.trim()).filter(Boolean)

  if (visibleNames.length === 0) return ''
  if (visibleNames.length === 1) return visibleNames[0]
  if (visibleNames.length === 2) return `${visibleNames[0]} and ${visibleNames[1]}`

  const namedPeople = visibleNames.slice(0, MAX_VISIBLE_NAMES).join(', ')
  const otherCount = visibleNames.length - MAX_VISIBLE_NAMES
  return `${namedPeople}, and ${otherCount} other${otherCount === 1 ? '' : 's'}`
}

export function formatTypingIndicatorText(
  items: Array<{ name: string; activity?: Doc<'typingIndicators'>['activity'] }>,
) {
  const names = items.map((item) => item.name)
  const people = formatNames(names)
  if (!people) return ''

  const activities = items.map((item) => normalizeActivity(item.activity))
  const firstActivity = activities[0] ?? 'typing'
  const hasMixedActivity = activities.some((activity) => activity !== firstActivity)
  if (hasMixedActivity) return `${people} ${items.length === 1 ? 'is composing' : 'are composing'}`
  return `${people} ${getActivityCopy(firstActivity, items.length !== 1)}`
}

export function TypingIndicatorLine({
  indicators,
}: {
  indicators: TypingIndicatorItem[]
}) {
  const [displayedIndicators, setDisplayedIndicators] = useState(indicators)
  const [leaving, setLeaving] = useState(false)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }

    if (indicators.length > 0) {
      setDisplayedIndicators(indicators)
      setLeaving(false)
      return undefined
    }

    if (displayedIndicators.length === 0) return undefined

    setLeaving(true)
    exitTimeoutRef.current = setTimeout(() => {
      setDisplayedIndicators([])
      setLeaving(false)
      exitTimeoutRef.current = null
    }, TYPING_INDICATOR_EXIT_MS)

    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
        exitTimeoutRef.current = null
      }
    }
  }, [displayedIndicators.length, indicators])

  const text = formatTypingIndicatorText(
    displayedIndicators.map((item) => ({
      activity: getIndicatorActivity(item),
      name: item.user?.displayName ?? 'Someone',
    })),
  )
  const visibleIndicators = displayedIndicators.slice(0, MAX_VISIBLE_AVATARS)
  const hiddenCount = Math.max(0, displayedIndicators.length - MAX_VISIBLE_AVATARS)
  const className = [
    'track-typing-indicator',
    text ? 'active' : '',
    leaving ? 'leaving' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={className}
    >
      {text ? (
        <div className="track-typing-indicator-content">
          <span className="track-typing-avatar-stack" aria-hidden="true">
            {visibleIndicators.map((item) => {
              const name = item.user?.displayName ?? 'Someone'
              return (
                <Avatar
                  className={`track-avatar track-typing-avatar ${getAvatarTone(item.user?.email ?? name)}`}
                  key={item.indicator._id}
                >
                  <AvatarFallback>{getInitials(name)}</AvatarFallback>
                </Avatar>
              )
            })}
            {hiddenCount > 0 ? <span className="track-typing-avatar-more">+{hiddenCount}</span> : null}
          </span>
          <span className="track-typing-text">{text}</span>
          <span className="track-typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : null}
    </div>
  )
}
