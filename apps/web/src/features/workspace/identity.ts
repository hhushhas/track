const avatarToneClasses = ['s-1', 's-2', 's-3', 's-4'] as const

/** CSS custom property names defined in styles.css (:root / .dark). */
const avatarToneCssVars = {
  's-1': '--avatar-tone-1',
  's-2': '--avatar-tone-2',
  's-3': '--avatar-tone-3',
  's-4': '--avatar-tone-4',
} as const

/** Light-mode fallbacks matching --avatar-tone-* when CSS is unavailable (SSR). */
const avatarToneLightFallbacks = {
  's-1': '#8f6a1f',
  's-2': '#5b6d4a',
  's-3': '#7a4a3a',
  's-4': '#3a4a6d',
} as const

export type AvatarTone = (typeof avatarToneClasses)[number]

export function getAvatarTone(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return avatarToneClasses[hash % avatarToneClasses.length] ?? avatarToneClasses[0]
}

export function getAvatarToneColor(tone: AvatarTone) {
  if (typeof document === 'undefined') {
    return avatarToneLightFallbacks[tone]
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(avatarToneCssVars[tone])
    .trim()

  return value || avatarToneLightFallbacks[tone]
}

export function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'T'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

export function getMentionHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getActiveMention(value: string, cursor: number) {
  const prefix = value.slice(0, cursor)
  const match = /(^|\s)@([a-z0-9._-]*)$/i.exec(prefix)
  if (!match) return null
  const start = prefix.length - match[2].length - 1
  return { start, end: cursor, query: match[2].toLowerCase() }
}
