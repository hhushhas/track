import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Columns3,
  Code2,
  FolderKanban,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  Rocket,
  Shield,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import { resolveEntityMark, type EntityMarkKind } from '@track/shared'

const icons: Record<ReturnType<typeof resolveEntityMark>['iconKey'], LucideIcon> = {
  analytics: BarChart3,
  board: Columns3,
  book: BookOpen,
  building: Building2,
  calendar: CalendarDays,
  channel: Hash,
  code: Code2,
  conversation: MessageCircle,
  design: ImageIcon,
  launch: Rocket,
  people: UsersRound,
  project: FolderKanban,
  shield: Shield,
}

type Props = {
  colorKey?: string | null
  iconKey?: string | null
  id: string
  imageUrl?: string | null
  kind: EntityMarkKind
  name: string
  size?: number
}

export function EntityMark({ colorKey, iconKey, id, imageUrl, kind, name, size = 32 }: Props) {
  const identity = resolveEntityMark({ colorKey, iconKey, id, kind, name })
  const [imageFailed, setImageFailed] = useState(false)
  const Icon = icons[identity.iconKey]
  const radius = kind === 'channel' ? '50%' : `${Math.round(size * 0.28)}px`
  return (
    <span
      aria-hidden="true"
      className={`track-entity-mark is-${kind}`}
      data-color={identity.colorKey}
      style={{
        backgroundColor: identity.palette.background,
        borderRadius: radius,
        color: identity.palette.foreground,
        height: size,
        width: size,
      }}
    >
      {kind === 'company' && imageUrl && !imageFailed
        ? <img alt="" height={Math.round(size * 0.72)} onError={() => setImageFailed(true)} src={imageUrl} width={Math.round(size * 0.72)} />
        : <Icon aria-hidden="true" size={Math.round(size * 0.48)} strokeWidth={2} />}
    </span>
  )
}
