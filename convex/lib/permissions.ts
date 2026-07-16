import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { resolveProjectAccessProfile } from '@track/shared/feature-flags'

export type AppCtx = QueryCtx | MutationCtx

export async function getProjectMember(
  ctx: AppCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', projectId).eq('userId', userId),
    )
    .unique()
}

export async function requireProjectMember(
  ctx: AppCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
) {
  const project = await ctx.db.get(projectId)
  if (!project || resolveProjectAccessProfile(project.accessProfile) !== 'legacy') {
    throw new Error('company_policy_required')
  }
  const member = await getProjectMember(ctx, projectId, userId)
  if (!member) {
    throw new Error('not_project_member')
  }
  return member
}

export async function requireProjectManager(
  ctx: AppCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
) {
  const member = await requireProjectMember(ctx, projectId, userId)
  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new Error('not_project_manager')
  }
  return member
}

export async function requireProjectOwner(
  ctx: AppCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
) {
  const member = await requireProjectMember(ctx, projectId, userId)
  if (member.role !== 'owner') {
    throw new Error('not_project_owner')
  }
  return member
}

export async function requireGroupMember(
  ctx: AppCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
) {
  const membership = await ctx.db
    .query('groupMembers')
    .withIndex('by_group_user', (q) =>
      q.eq('groupId', groupId).eq('userId', userId),
    )
    .unique()
  if (!membership) {
    throw new Error('not_group_member')
  }
  const project = await ctx.db.get(membership.projectId)
  if (!project || resolveProjectAccessProfile(project.accessProfile) !== 'legacy') {
    throw new Error('company_policy_required')
  }
  return membership
}

export function canRoleJoinDefaultGroup(
  role: Doc<'projectMembers'>['role'],
  kind: Doc<'groups'>['kind'],
) {
  if (kind === 'general') return true
  if (kind === 'internal') return role !== 'client'
  if (kind === 'commercials') return role === 'owner' || role === 'admin'
  return false
}
