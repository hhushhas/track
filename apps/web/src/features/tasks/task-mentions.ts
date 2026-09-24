function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function commentContainsMention(value: string, displayName: string) {
  return new RegExp(`(^|\\s)@${escapeRegularExpression(displayName)}(?=$|\\s|[.,!?;:])`, 'u').test(value)
}

export type MentionCandidate = {
  companyName?: string
  displayName: string
  memberId: string
}

export function mentionTokenForCandidate(candidate: MentionCandidate, candidates: ReadonlyArray<MentionCandidate>) {
  const sameName = candidates.filter((item) => item.displayName === candidate.displayName)
  if (sameName.length < 2) return candidate.displayName

  const qualifiedName = candidate.companyName
    ? `${candidate.displayName} · ${candidate.companyName}`
    : `${candidate.displayName} · member`
  const sameQualifiedName = sameName.filter((item) => item.companyName === candidate.companyName)
  if (sameQualifiedName.length < 2) return qualifiedName
  return `${qualifiedName} · ${candidate.memberId.slice(-6)}`
}

export function mentionQueryAtCursor(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/u)
  if (!match) return null
  const query = match[2] ?? ''
  return { query, start: cursor - query.length - 1 }
}
