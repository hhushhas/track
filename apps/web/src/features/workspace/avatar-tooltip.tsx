import type { ComponentProps, ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'

type AvatarNameTooltipProps = {
  align?: ComponentProps<typeof TooltipContent>['align']
  bio?: string | null
  children: ReactNode
  detail?: string | null
  name: string
  side?: ComponentProps<typeof TooltipContent>['side']
  timezone?: string | null
}

export function AvatarNameTooltip({
  align = 'center',
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
        <span className="track-avatar-tooltip-copy">
          <strong>{name}</strong>
          {detail ? <small>{detail}</small> : null}
          {localTime ? <small>{localTime}</small> : null}
          {bio ? <span>{bio}</span> : null}
        </span>
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
