import { useEffect, useState } from 'react'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import { getAvatarTone, getInitials } from './identity'

type AvatarNameTooltipProps = {
  align?: ComponentProps<typeof TooltipContent>['align']
  avatarUrl?: string | null
  bio?: string | null
  children: ReactNode
  detail?: string | null
  name: string
  side?: ComponentProps<typeof TooltipContent>['side']
  timezone?: string | null
}

export function AvatarNameTooltip({
  align = 'center',
  avatarUrl,
  bio,
  children,
  detail,
  name,
  side = 'top',
  timezone,
}: AvatarNameTooltipProps) {
  const localTime = timezone ? getLocalTimeLabel(timezone) : null
  const [imagePalette, setImagePalette] = useState<{ primary: string; secondary: string } | null>(null)

  useEffect(() => {
    if (!avatarUrl || typeof window === 'undefined') {
      setImagePalette(null)
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      const palette = getImagePalette(image)
      if (palette) setImagePalette(palette)
    }
    image.onerror = () => {
      if (!cancelled) setImagePalette(null)
    }
    image.src = avatarUrl
    return () => {
      cancelled = true
    }
  }, [avatarUrl])

  const cardStyle = imagePalette
    ? ({
        '--track-avatar-card-primary': imagePalette.primary,
        '--track-avatar-card-secondary': imagePalette.secondary,
      } as CSSProperties)
    : undefined

  return (
    <Tooltip>
      <TooltipTrigger
        closeOnClick={false}
        render={(props) => (
          <span
            {...props}
            className={['track-avatar-tooltip-trigger', props.className].filter(Boolean).join(' ')}
          >
            {children}
          </span>
        )}
      />
      <TooltipContent
        align={align}
        className="track-avatar-tooltip"
        side={side}
        sideOffset={8}
      >
        <div className="track-avatar-card" style={cardStyle}>
          <div className="track-avatar-card-banner" />
          <div className="track-avatar-card-body">
            <Avatar className={`track-avatar-card-avatar ${getAvatarTone(name)}`}>
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="track-avatar-card-copy">
              <strong>{name}</strong>
              {detail ? <small>{detail}</small> : null}
              {localTime ? <small>{localTime}</small> : null}
              {bio ? <p>{bio}</p> : null}
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function getImagePalette(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  const size = 24
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  try {
    context.drawImage(image, 0, 0, size, size)
    const pixels = context.getImageData(0, 0, size, size).data
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3] ?? 0
      if (alpha < 80) continue
      r += pixels[index] ?? 0
      g += pixels[index + 1] ?? 0
      b += pixels[index + 2] ?? 0
      count += 1
    }
    if (!count) return null
    const primary = `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`
    const secondary = `rgb(${Math.max(0, Math.round(r / count) - 32)}, ${Math.max(0, Math.round(g / count) - 32)}, ${Math.max(0, Math.round(b / count) - 32)})`
    return { primary, secondary }
  } catch {
    return null
  }
}

function getLocalTimeLabel(timezone: string) {
  try {
    return new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date())
  } catch {
    return timezone
  }
}
