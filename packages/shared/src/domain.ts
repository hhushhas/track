export const projectRoles = ['owner', 'admin', 'staff', 'client'] as const
export type ProjectRole = (typeof projectRoles)[number]

export const defaultGroupKinds = ['general', 'internal', 'commercials'] as const
export type DefaultGroupKind = (typeof defaultGroupKinds)[number]

export const groupKinds = [...defaultGroupKinds, 'custom'] as const
export type GroupKind = (typeof groupKinds)[number]

export const reviewerAuthority = 'canReviewAiRecords' as const

export const recordTypes = [
  'task',
  'scope_change',
  'decision',
  'action_item',
  'blocker',
  'question',
] as const
export type RecordType = (typeof recordTypes)[number]

export const recordClassifications = [
  'official_record',
  'billable_scope',
  'non_billable_scope',
  'informational',
  'ignored',
] as const
export type RecordClassification = (typeof recordClassifications)[number]

export const recordStatuses = [
  'proposed',
  'accepted',
  'declined',
  'open',
  'in_progress',
  'blocked',
  'done',
] as const
export type RecordStatus = (typeof recordStatuses)[number]

export const notificationModes = ['all', 'mentions', 'none'] as const
export type NotificationMode = (typeof notificationModes)[number]

export const groupNotificationModes = ['inherit', ...notificationModes] as const
export type GroupNotificationMode = (typeof groupNotificationModes)[number]

export const defaultGroups = [
  {
    kind: 'general',
    name: 'General',
    roleDefaults: ['owner', 'admin', 'staff', 'client'],
  },
  {
    kind: 'internal',
    name: 'Internal',
    roleDefaults: ['owner', 'admin', 'staff'],
  },
  {
    kind: 'commercials',
    name: 'Commercials',
    roleDefaults: ['owner', 'admin'],
  },
] as const satisfies ReadonlyArray<{
  kind: DefaultGroupKind
  name: string
  roleDefaults: ReadonlyArray<ProjectRole>
}>

export function roleCanJoinDefaultGroup(role: ProjectRole, kind: GroupKind) {
  const group = defaultGroups.find((item) => item.kind === kind)
  if (!group) return false
  return group.roleDefaults.some((roleDefault) => roleDefault === role)
}

export function parseMentions(body: string) {
  return Array.from(
    new Set(
      body
        .match(/@[a-z0-9._-]+/gi)
        ?.map((mention) => mention.slice(1).toLowerCase()) ?? [],
    ),
  )
}

export function shouldNotifyForMessage(input: {
  globalMode: NotificationMode
  groupMode: GroupNotificationMode
  mentioned: boolean
}) {
  const mode = input.groupMode === 'inherit' ? input.globalMode : input.groupMode
  if (mode === 'none') return false
  if (mode === 'all') return true
  return input.mentioned
}
