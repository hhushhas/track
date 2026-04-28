import type { ComponentProps, ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'

type AvatarNameTooltipProps = {
  align?: ComponentProps<typeof TooltipContent>['align']
  children: ReactNode
  detail?: string | null
  name: string
  side?: ComponentProps<typeof TooltipContent>['side']
}

export function AvatarNameTooltip({
  align = 'center',
  children,
  detail,
  name,
  side = 'top',
}: AvatarNameTooltipProps) {
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
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
