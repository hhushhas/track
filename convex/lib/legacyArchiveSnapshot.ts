import type { QueryCtx } from '../_generated/server'
import type { ArchivedChannelSnapshot, ArchivedMemberSnapshot } from './projectExitArchive'

export function decodeLegacyArchivedProject(value: unknown) {
  if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string') {
    throw new Error('archive_project_snapshot_invalid')
  }
  return {
    name: value.name,
    description: 'description' in value && typeof value.description === 'string' ? value.description : undefined,
  }
}

export function decodeLegacyArchivedMember(
  ctx: QueryCtx,
  value: unknown,
): ArchivedMemberSnapshot {
  if (!value || typeof value !== 'object' || !('membership' in value) || !('user' in value)) {
    throw new Error('archive_member_snapshot_invalid')
  }
  const membership = value.membership
  const user = value.user
  if (!membership || typeof membership !== 'object' || !user || typeof user !== 'object'
    || !('_id' in membership) || typeof membership._id !== 'string'
    || !('userId' in membership) || typeof membership.userId !== 'string'
    || !('role' in membership) || (membership.role !== 'manager' && membership.role !== 'member')
    || !('displayName' in user) || typeof user.displayName !== 'string') {
    throw new Error('archive_member_snapshot_invalid')
  }
  const memberId = ctx.db.normalizeId('projectMembers', membership._id)
  const userId = ctx.db.normalizeId('users', membership.userId)
  const companyId = 'companyId' in membership && typeof membership.companyId === 'string'
    ? ctx.db.normalizeId('companies', membership.companyId) : null
  if (!memberId || !userId) throw new Error('archive_member_snapshot_invalid')
  const company = 'company' in value ? value.company : null
  const companyDisplayName = company && typeof company === 'object'
    && 'displayName' in company && typeof company.displayName === 'string'
    ? company.displayName : undefined
  return {
    membership: {
      _id: memberId, userId, companyId: companyId ?? undefined,
      role: membership.role, status: 'archived',
      userDisplayNameSnapshot: user.displayName,
      companyDisplayNameSnapshot: companyDisplayName,
    },
    user: { _id: userId, displayName: user.displayName },
    company: companyId && companyDisplayName
      ? { _id: companyId, displayName: companyDisplayName } : undefined,
  }
}

export function decodeLegacyArchivedChannel(
  ctx: QueryCtx,
  value: unknown,
): ArchivedChannelSnapshot {
  if (!value || typeof value !== 'object'
    || !('_id' in value) || typeof value._id !== 'string'
    || !('name' in value) || typeof value.name !== 'string') {
    throw new Error('archive_channel_snapshot_invalid')
  }
  const groupId = ctx.db.normalizeId('groups', value._id)
  if (!groupId) throw new Error('archive_channel_snapshot_invalid')
  return {
    _id: groupId,
    name: value.name,
    kind: 'kind' in value && typeof value.kind === 'string' ? value.kind : 'general',
    createdAt: 'createdAt' in value && typeof value.createdAt === 'number' ? value.createdAt : 0,
    status: 'status' in value && typeof value.status === 'string' ? value.status : 'archived',
  }
}

export function paginateLegacySnapshot<T>(
  values: ReadonlyArray<T>,
  options: { cursor: string | null; numItems: number },
) {
  const cursor = options.cursor
  if (cursor !== null && !/^legacy:\d+$/.test(cursor)) throw new Error('archive_cursor_invalid')
  const offset = cursor === null ? 0 : Number(cursor.slice('legacy:'.length))
  if (!Number.isSafeInteger(offset)) throw new Error('archive_cursor_invalid')
  const end = Math.min(values.length, offset + Math.max(1, Math.min(100, options.numItems)))
  return {
    page: values.slice(offset, end),
    isDone: end >= values.length,
    continueCursor: `legacy:${end}`,
  }
}
