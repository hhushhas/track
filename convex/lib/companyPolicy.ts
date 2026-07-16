import { canAdministerCompany } from '@track/shared/company'
import { resolveProjectAccessProfile } from '@track/shared/feature-flags'
import { resolveProjectChannelCapabilities } from '@track/shared/project-policy'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

import type { AuthenticatedActor } from './actorContext'

type PolicyCtx = QueryCtx | MutationCtx

export function requireCompanyModelEnabled() {
  if (process.env.TRACK_COMPANY_MODEL_ENABLED !== 'true') {
    throw new Error('company_model_disabled')
  }
}

export async function getCompanyMembership(
  ctx: PolicyCtx,
  companyId: Id<'companies'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('companyMembers')
    .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', userId))
    .unique()
}

export async function requireActiveCompanyMembership(
  ctx: PolicyCtx,
  actor: AuthenticatedActor,
  companyId: Id<'companies'>,
) {
  const [company, membership] = await Promise.all([
    ctx.db.get(companyId),
    getCompanyMembership(ctx, companyId, actor.userId),
  ])
  if (!company || company.status !== 'active' || !membership || membership.status !== 'active') {
    throw new Error('company_unavailable')
  }
  return { company, membership }
}

export async function requireCompanyAdmin(
  ctx: PolicyCtx,
  actor: AuthenticatedActor,
  companyId: Id<'companies'>,
) {
  const context = await requireActiveCompanyMembership(ctx, actor, companyId)
  if (!canAdministerCompany(context.membership.role)) throw new Error('company_admin_required')
  return context
}

export async function requireCompanyOwner(
  ctx: PolicyCtx,
  actor: AuthenticatedActor,
  companyId: Id<'companies'>,
  allowSuspendedCompany = false,
) {
  const [company, membership] = await Promise.all([
    ctx.db.get(companyId),
    getCompanyMembership(ctx, companyId, actor.userId),
  ])
  const companyAvailable = company?.status === 'active' || (allowSuspendedCompany && company?.status === 'suspended')
  if (!company || !companyAvailable || !membership || membership.status !== 'active' || membership.role !== 'owner') {
    throw new Error('company_owner_required')
  }
  return { company, membership }
}

export async function requireActiveRelationshipParticipant(
  ctx: PolicyCtx,
  relationshipId: Id<'relationships'>,
  companyId: Id<'companies'>,
) {
  const terms = await ctx.db
    .query('relationshipCompanies')
    .withIndex('by_relationship_status', (q) =>
      q.eq('relationshipId', relationshipId).eq('status', 'active'),
    )
    .collect()
  const term = terms.find((candidate) => candidate.companyId === companyId)
  if (!term) throw new Error('relationship_unavailable')
  return term
}

function isCompanyProjectRole(role: Doc<'projectMembers'>['role']) {
  return role === 'manager' || role === 'member'
}

export async function resolveCompanyProjectAccess(
  ctx: PolicyCtx,
  actor: AuthenticatedActor,
  input: {
    projectId: Id<'projects'>
    actingCompanyId: Id<'companies'>
    projectMemberId: Id<'projectMembers'>
    groupId?: Id<'groups'>
  },
) {
  const [project, companyContext, projectMember] = await Promise.all([
    ctx.db.get(input.projectId),
    requireActiveCompanyMembership(ctx, actor, input.actingCompanyId),
    ctx.db.get(input.projectMemberId),
  ])
  if (!project || resolveProjectAccessProfile(project.accessProfile) !== 'company') {
    throw new Error('project_unavailable')
  }
  if (
    !projectMember ||
    projectMember.projectId !== project._id ||
    projectMember.userId !== actor.userId ||
    projectMember.companyId !== input.actingCompanyId ||
    !projectMember.projectCompanyId ||
    !isCompanyProjectRole(projectMember.role) ||
    (projectMember.status !== 'active' && projectMember.status !== 'archived')
  ) {
    throw new Error('project_unavailable')
  }

  const projectCompany = await ctx.db.get(projectMember.projectCompanyId)
  const archiveMode = projectMember.status === 'archived'
  if (
    !projectCompany ||
    projectCompany.projectId !== project._id ||
    projectCompany.companyId !== input.actingCompanyId ||
    (archiveMode ? projectCompany.status !== 'exited' : projectCompany.status !== 'active')
  ) {
    throw new Error('project_unavailable')
  }

  const entitlement = archiveMode
    ? await ctx.db
        .query('projectArchiveEntitlements')
        .withIndex('by_member', (q) => q.eq('projectMemberId', projectMember._id))
        .unique()
    : null
  if (archiveMode && entitlement?.retentionStatus !== 'active') {
    throw new Error('project_unavailable')
  }

  const groupId = input.groupId
  const group = groupId ? await ctx.db.get(groupId) : null
  if (input.groupId && (!group || group.projectId !== project._id)) {
    throw new Error('channel_unavailable')
  }
  const channelMembership = groupId && !archiveMode
    ? await ctx.db
        .query('groupMembers')
        .withIndex('by_group_project_member', (q) =>
          q.eq('groupId', groupId).eq('projectMemberId', projectMember._id),
        )
        .unique()
    : null
  const channelMember = archiveMode
    ? Boolean(groupId && entitlement?.channelIds.includes(groupId))
    : channelMembership?.status === 'active'
  const capabilities = resolveProjectChannelCapabilities({
    accessProfile: 'company',
    accessMode: archiveMode || project.status === 'archived' ? 'archive' : 'active',
    projectRole: projectMember.role as 'manager' | 'member',
    channelMember,
    channelActive: !group?.status || group.status === 'active',
    channelSteward: channelMembership?.isSteward === true,
  })

  return {
    actor,
    company: companyContext.company,
    companyMember: companyContext.membership,
    project,
    projectCompany,
    projectMember,
    group,
    groupMember: channelMembership,
    entitlement,
    capabilities,
  }
}

export async function requireCompanyProjectManager(
  ctx: PolicyCtx,
  actor: AuthenticatedActor,
  input: Parameters<typeof resolveCompanyProjectAccess>[2],
) {
  const access = await resolveCompanyProjectAccess(ctx, actor, input)
  if (!access.capabilities.canManageProject) throw new Error('project_manager_required')
  return access
}
