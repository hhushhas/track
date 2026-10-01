export const entityMarkColorKeys = [
  'blue',
  'teal',
  'violet',
  'rose',
  'green',
  'amber',
  'slate',
  'clay',
] as const

export type EntityMarkColorKey = (typeof entityMarkColorKeys)[number]

export const entityMarkIconKeys = [
  'building',
  'project',
  'board',
  'channel',
  'conversation',
  'people',
  'code',
  'design',
  'launch',
  'analytics',
  'calendar',
  'book',
  'shield',
] as const

export type EntityMarkIconKey = (typeof entityMarkIconKeys)[number]
export type EntityMarkKind = 'company' | 'project' | 'board' | 'channel'

export const entityMarkPalette: Record<EntityMarkColorKey, { background: string; foreground: string }> = {
  blue: { background: '#E9F0F4', foreground: '#355A6A' },
  teal: { background: '#E6F0EE', foreground: '#315F58' },
  violet: { background: '#EFEBF4', foreground: '#605276' },
  rose: { background: '#F4EAED', foreground: '#8A4F60' },
  green: { background: '#E8F0EB', foreground: '#42634E' },
  amber: { background: '#F6F0E2', foreground: '#765A23' },
  slate: { background: '#ECEFF1', foreground: '#4F5C65' },
  clay: { background: '#F4EBE5', foreground: '#80583F' },
}

const defaultIcon: Record<EntityMarkKind, EntityMarkIconKey> = {
  company: 'building',
  project: 'project',
  board: 'board',
  channel: 'channel',
}

const projectTerms: ReadonlyArray<[EntityMarkIconKey, readonly string[]]> = [
  ['code', ['engineering', 'developer', 'software', 'code', 'api']],
  ['design', ['design', 'creative', 'brand', 'visual']],
  ['launch', ['launch', 'release', 'rollout', 'ship']],
  ['analytics', ['analytics', 'data', 'report', 'research']],
  ['calendar', ['planning', 'roadmap', 'schedule', 'event']],
  ['book', ['docs', 'documentation', 'knowledge', 'content']],
  ['shield', ['security', 'privacy', 'compliance', 'risk']],
  ['people', ['people', 'team', 'hiring', 'customer', 'support']],
]

const channelTerms: ReadonlyArray<[EntityMarkIconKey, readonly string[]]> = [
  ['code', ['engineering', 'developer', 'software', 'code']],
  ['design', ['design', 'creative', 'brand']],
  ['launch', ['release', 'launch', 'incident']],
  ['analytics', ['data', 'analytics', 'research']],
  ['book', ['docs', 'documentation', 'knowledge']],
  ['shield', ['security', 'privacy', 'legal', 'compliance']],
  ['people', ['internal', 'team', 'staff', 'members']],
  ['conversation', ['general', 'announcements', 'chat', 'discussion']],
]

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function iconFromName(kind: EntityMarkKind, name: string): EntityMarkIconKey {
  const normalizedName = name.trim().toLowerCase()
  const terms = kind === 'channel' ? channelTerms : projectTerms
  if (kind === 'company') return defaultIcon.company
  for (const [icon, keywords] of terms) {
    if (keywords.some((keyword) => normalizedName.includes(keyword))) return icon
  }
  return defaultIcon[kind]
}

export function isEntityMarkColorKey(value: string): value is EntityMarkColorKey {
  return (entityMarkColorKeys as readonly string[]).includes(value)
}

export function isEntityMarkIconKey(value: string): value is EntityMarkIconKey {
  return (entityMarkIconKeys as readonly string[]).includes(value)
}

/** Stable, cross-platform fallback identity. Never use this color for task state. */
export function resolveEntityMark(input: {
  colorKey?: string | null
  iconKey?: string | null
  id: string
  kind: EntityMarkKind
  name: string
}) {
  const index = stableHash(`${input.kind}:${input.id}`)
  const fallbackColor = entityMarkColorKeys[index % entityMarkColorKeys.length]!
  const colorKey = input.colorKey && isEntityMarkColorKey(input.colorKey) ? input.colorKey : fallbackColor
  const iconKey = input.iconKey && isEntityMarkIconKey(input.iconKey)
    ? input.iconKey
    : iconFromName(input.kind, input.name)

  return { colorKey, iconKey, palette: entityMarkPalette[colorKey] }
}
