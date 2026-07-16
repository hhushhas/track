import type { Id } from '../_generated/dataModel'

export const contextPath = 'context.md'
export const contextTargetChars = 20_000
export const contextHardLimitChars = 32_000
export const maxSingleContextInsertChars = 6_000
export const defaultMemoryBashTimeoutMs = 30_000
export const maxMemoryBashTimeoutMs = 120_000
export const bashOutputLimitChars = 12_000

export const initialContextTemplate = `# Project Context

## Project Snapshot

## People And Roles

## Decisions And Constraints

## Current Work

## Open Questions

## Important Sources

## Memory Hygiene
`

export type MemoryActorRole = 'owner' | 'admin' | 'staff' | 'client' | 'manager' | 'member'

export type BoxAccessScope = {
  projectId: Id<'projects'> | string
  boxId: string
  actorUserId: Id<'users'> | string
  role: MemoryActorRole
  canAccessAllGroups: boolean
  allowedGroupIds: Array<Id<'groups'> | string>
  runId?: string
}

export type MemoryPathDecision =
  | { allowed: true; normalizedPath: string }
  | { allowed: false; normalizedPath?: string; reason: string }

export type ContextEdit = {
  oldText: string
  newText: string
}

export type ContextMutationMode = 'init' | 'edit' | 'write' | 'compaction'

export type ContextMutationDecision =
  | {
      allowed: true
      newContent: string
      oldLength: number
      newLength: number
      insertedLength: number
      diffSummary: string
    }
  | {
      allowed: false
      oldLength: number
      newLength?: number
      insertedLength?: number
      reason: string
    }

const unsafePromptPromotionPattern =
  /\b(ignore|disregard|override|forget)\b.{0,80}\b(system|developer|track|previous|above|instructions?)\b|\b(reveal|print|exfiltrate|disable)\b.{0,80}\b(secrets?|audit|logs?|credentials?)\b|\btreat\b.{0,80}\b(as|like)\b.{0,80}\b(system|developer)\b/i

const blockedBashPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(^|[;&|]\s*)nohup\b|\bdisown\b|\bscreen\b|\btmux\b|(?:^|[^\s&|;])\s&\s*(?:$|[;|])/, reason: 'background_or_daemon_command' },
  { pattern: /\bpython(?:3)?\s+-m\s+http\.server\b|\bvite\s+--host\b|\bnpm\s+start\b|\bpnpm\s+dev\b/, reason: 'long_running_server_command' },
  { pattern: /\brm\s+-[^\n;|&]*r[^\n;|&]*f[^\n;|&]*\s+\/(?:\s|$)|\bmkfs\b|\bdd\b[^\n;|&]*\bof=|\b(?:u)?mount\b|\bshutdown\b|\breboot\b/, reason: 'destructive_system_command' },
  { pattern: /(^|[;&|]\s*)(sudo|su|apt|apt-get|apk|brew)\b|\bnpm\s+(install|i)\b|\bpnpm\s+add\b|\byarn\s+add\b|\bpip(?:3)?\s+install\b/, reason: 'privilege_or_package_install_command' },
  { pattern: /(^|[;&|]\s*)(ssh|scp|rsync|ftp|sftp|nc|ncat|socat)\b/, reason: 'remote_shell_or_transfer_command' },
  { pattern: /\bcurl\b[^\n;|&]*(?:-T|--upload-file|--data-binary\s+@|-d\s+@)|\bwget\b[^\n;|&]*(?:--post-file|--body-file)/, reason: 'upload_or_exfiltration_pattern' },
  { pattern: /\b(?:UPSTASH_BOX_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|AUTH_SECRET|BETTER_AUTH_SECRET|CONVEX_DEPLOY_KEY|CONVEX_SELF_HOSTED_ADMIN_KEY)\b/, reason: 'secret_environment_access' },
]

export function normalizeMemoryPath(path: string): MemoryPathDecision {
  if (!path || !path.trim()) return { allowed: false, reason: 'empty_path' }
  if (path.includes('\0')) return { allowed: false, reason: 'nul_byte_path' }
  const trimmed = path.trim()
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('~') ||
    /^[a-z]:[\\/]/i.test(trimmed) ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  ) {
    return { allowed: false, reason: 'path_escape' }
  }

  const segments = trimmed.replaceAll('\\', '/').split('/')
  const normalized: Array<string> = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') return { allowed: false, reason: 'path_escape' }
    normalized.push(segment)
  }
  if (normalized.length === 0) return { allowed: false, reason: 'empty_path' }
  return { allowed: true, normalizedPath: normalized.join('/') }
}

export function canAccessMemoryPath(
  scope: BoxAccessScope,
  path: string,
  operation: 'read' | 'write' | 'edit' | 'bash',
): MemoryPathDecision {
  const normalized = normalizeMemoryPath(path)
  if (!normalized.allowed) return normalized

  const normalizedPath = normalized.normalizedPath
  if (operation === 'bash') {
    const runPrefix = scope.runId ? `scratch/runs/${scope.runId}/view` : 'scratch/runs/'
    return normalizedPath.startsWith(runPrefix)
      ? { allowed: true, normalizedPath }
      : { allowed: false, normalizedPath, reason: 'bash_outside_run_view' }
  }
  if (normalizedPath === contextPath) return { allowed: true, normalizedPath }
  if (normalizedPath.startsWith('scratch/runs/') && scope.runId && normalizedPath.startsWith(`scratch/runs/${scope.runId}/view/`)) {
    return { allowed: true, normalizedPath }
  }
  const groupMatch = /^scratch\/groups\/([^/]+)\//.exec(normalizedPath)
  if (!groupMatch) {
    return { allowed: false, normalizedPath, reason: 'path_not_in_allowed_memory_surface' }
  }
  if (scope.canAccessAllGroups || scope.allowedGroupIds.map(String).includes(groupMatch[1])) {
    return { allowed: true, normalizedPath }
  }
  return { allowed: false, normalizedPath, reason: 'group_scope_denied' }
}

export function applyExactContextEdits(content: string, edits: Array<ContextEdit>) {
  let next = content
  for (const edit of edits) {
    if (!edit.oldText) return { ok: false as const, reason: 'empty_old_text' }
    const index = next.indexOf(edit.oldText)
    if (index === -1) return { ok: false as const, reason: 'old_text_not_found' }
    next = `${next.slice(0, index)}${edit.newText}${next.slice(index + edit.oldText.length)}`
  }
  return { ok: true as const, content: next }
}

export function validateContextMutation(input: {
  currentContent: string
  nextContent: string
  mode: ContextMutationMode
}): ContextMutationDecision {
  const oldLength = input.currentContent.length
  const newLength = input.nextContent.length
  const insertedLength = Math.max(0, newLength - oldLength)

  if (newLength > contextHardLimitChars) {
    return { allowed: false, oldLength, newLength, insertedLength, reason: 'context_hard_limit_exceeded' }
  }
  if (
    input.mode !== 'compaction' &&
    insertedLength > maxSingleContextInsertChars &&
    newLength >= oldLength
  ) {
    return { allowed: false, oldLength, newLength, insertedLength, reason: 'context_insert_limit_exceeded' }
  }
  if (
    input.mode === 'write' &&
    oldLength > initialContextTemplate.length &&
    input.nextContent !== input.currentContent
  ) {
    return { allowed: false, oldLength, newLength, insertedLength, reason: 'context_direct_overwrite_denied' }
  }
  if (input.mode !== 'compaction' && oldLength > 1_000 && looksLikeWholesaleReplacement(input.currentContent, input.nextContent)) {
    return { allowed: false, oldLength, newLength, insertedLength, reason: 'context_wholesale_replacement_denied' }
  }
  if (unsafePromptPromotionPattern.test(input.nextContent)) {
    return { allowed: false, oldLength, newLength, insertedLength, reason: 'prompt_injection_promotion_rejected' }
  }

  return {
    allowed: true,
    newContent: input.nextContent,
    oldLength,
    newLength,
    insertedLength,
    diffSummary: summarizeContextDiff(input.currentContent, input.nextContent),
  }
}

export function checkBashCommandPolicy(command: string, timeoutMs = defaultMemoryBashTimeoutMs) {
  const trimmed = command.trim()
  if (!trimmed) return { allowed: false as const, reason: 'empty_command' }
  if (timeoutMs > maxMemoryBashTimeoutMs) return { allowed: false as const, reason: 'timeout_exceeds_phase_1_limit' }
  for (const rule of blockedBashPatterns) {
    if (rule.pattern.test(trimmed)) return { allowed: false as const, reason: rule.reason }
  }
  return { allowed: true as const, command: trimmed, timeoutMs: Math.max(1_000, timeoutMs) }
}

export function truncateMemoryOutput(text: string, limit = bashOutputLimitChars) {
  if (text.length <= limit) return { text, truncated: false }
  return { text: text.slice(0, limit), truncated: true }
}

function looksLikeWholesaleReplacement(currentContent: string, nextContent: string) {
  const currentHeadings = extractContextHeadings(currentContent)
  const nextHeadings = extractContextHeadings(nextContent)
  const sharedHeadings = currentHeadings.filter((heading) => nextHeadings.includes(heading)).length
  if (sharedHeadings < Math.min(3, currentHeadings.length)) return true

  const currentWords = new Set(currentContent.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
  const nextWords = new Set(nextContent.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
  if (currentWords.size < 40) return false
  let sharedWords = 0
  for (const word of currentWords) {
    if (nextWords.has(word)) sharedWords += 1
  }
  return sharedWords / currentWords.size < 0.25
}

function extractContextHeadings(content: string) {
  return content
    .split('\n')
    .filter((line) => /^#{1,3}\s+\S/.test(line))
    .map((line) => line.trim().toLowerCase())
}

function summarizeContextDiff(currentContent: string, nextContent: string) {
  if (currentContent === nextContent) return 'no content change'
  const oldLength = currentContent.length
  const newLength = nextContent.length
  const delta = newLength - oldLength
  return `context length ${oldLength} -> ${newLength} (${delta >= 0 ? '+' : ''}${delta})`
}
