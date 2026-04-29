import type { ComponentProps, ReactNode } from 'react'

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
        <div className="track-avatar-card">
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
