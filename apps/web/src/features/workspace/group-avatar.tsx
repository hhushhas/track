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

import { resolveEntityMark, type EntityMarkIconKey } from '@track/shared'
import type { GroupReference } from './group-types'

type GroupAvatar = { Icon: LucideIcon; tone: string }

const icons: Record<EntityMarkIconKey, LucideIcon> = {
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

/** Shared scope identity resolution keeps names, colors, and glyphs stable on web and mobile. */
export function getGroupAvatar(group: GroupReference): GroupAvatar {
  const mark = resolveEntityMark({
    colorKey: group.markColorKey,
    iconKey: group.markIconKey,
    id: group._id,
    kind: 'channel',
    name: group.name,
  })
  return { Icon: icons[mark.iconKey], tone: mark.colorKey }
}
