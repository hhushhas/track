const avatarToneClasses = ['s-1', 's-2', 's-3', 's-4'] as const

export function getAvatarTone(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return avatarToneClasses[hash % avatarToneClasses.length] ?? avatarToneClasses[0]
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
