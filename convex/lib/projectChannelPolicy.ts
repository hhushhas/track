import type { CompanyProjectRole } from '@track/shared/company'
import type { ProjectRole as LegacyProjectRole } from '@track/shared/domain'
import { resolveProjectAccessProfile } from '@track/shared/feature-flags'
import { resolveProjectChannelCapabilities } from '@track/shared/project-policy'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

import type { AuthenticatedActor } from './actorContext'

type PolicyCtx = QueryCtx | MutationCtx

export type ProjectChannelContext = Readonly<{
  actor: AuthenticatedActor
  project: Doc<'projects'>
  projectMember: Doc<'projectMembers'>
  groupId: Id<'groups'> | null
  groupMemberId: Id<'groupMembers'> | null
  actingCompanyId: Id<'companies'> | null
  capabilities: ReturnType<typeof resolveProjectChannelCapabilities>
}>

export type ProjectChannelContextInput = Readonly<{
  actor: AuthenticatedActor
  projectId: Id<'projects'>
  groupId?: Id<'groups'>
  selectedProjectMemberId?: Id<'projectMembers'>
  actingCompanyId?: Id<'companies'>
}>

function isLegacyRole(role: Doc<'projectMembers'>['role']): role is LegacyProjectRole {
  return role === 'owner' || role === 'admin' || role === 'staff' || role === 'client'
}

function isCompanyRole(role: Doc<'projectMembers'>['role']): role is CompanyProjectRole {
  return role === 'manager' || role === 'member'
}

async function resolveLegacyContext(
  ctx: PolicyCtx,
  project: Doc<'projects'>,
  input: ProjectChannelContextInput,
  channelActive: boolean,
): Promise<ProjectChannelContext> {
  const projectMember = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', project._id).eq('userId', input.actor.userId),
    )
    .unique()
  if (!projectMember || !isLegacyRole(projectMember.role)) {
    throw new Error('project_unavailable')
  }

  const groupId = input.groupId
  const groupMember = groupId
    ? await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (q) =>
          q.eq('groupId', groupId).eq('userId', input.actor.userId),
        )
        .unique()
    : null
  const channelMember = Boolean(
    groupMember &&
      groupMember.projectId === project._id &&
      (!groupMember.status || groupMember.status === 'active'),
  )
  const accessMode = project.status === 'archived' ? 'archive' : 'active'

  return {
    actor: input.actor,
    project,
    projectMember,
    groupId: input.groupId ?? null,
    groupMemberId: channelMember ? groupMember?._id ?? null : null,
    actingCompanyId: null,
    capabilities: resolveProjectChannelCapabilities({
      accessProfile: 'legacy',
      accessMode,
      projectRole: projectMember.role,
      channelMember,
      channelActive,
      channelSteward: channelMember,
    }),
  }
}

async function resolveCompanyContext(
  ctx: PolicyCtx,
  project: Doc<'projects'>,
  input: ProjectChannelContextInput,
  channelActive: boolean,
): Promise<ProjectChannelContext> {
  if (!input.selectedProjectMemberId || !input.actingCompanyId) {
    throw new Error('actor_context_required')
  }

  const actingCompanyId = input.actingCompanyId
  const [projectMember, company] = await Promise.all([
    ctx.db.get(input.selectedProjectMemberId),
    ctx.db.get(actingCompanyId),
  ])
  if (
    (project.status !== 'active' &&
      project.status !== 'archive_pending' &&
      project.status !== 'archived') ||
    !projectMember ||
    projectMember.projectId !== project._id ||
    projectMember.userId !== input.actor.userId ||
    projectMember.companyId !== actingCompanyId ||
    !projectMember.projectCompanyId ||
    !isCompanyRole(projectMember.role) ||
    (projectMember.status !== 'active' && projectMember.status !== 'archived') ||
    !company ||
    company.status !== 'active'
  ) {
    throw new Error('project_unavailable')
  }

  const [companyMember, projectCompany] = await Promise.all([
    ctx.db
      .query('companyMembers')
      .withIndex('by_company_user', (q) =>
        q.eq('companyId', actingCompanyId).eq('userId', input.actor.userId),
      )
      .unique(),
    ctx.db.get(projectMember.projectCompanyId),
  ])
  if (
    !companyMember ||
    companyMember.status !== 'active' ||
    !projectCompany ||
    projectCompany.projectId !== project._id ||
    projectCompany.companyId !== actingCompanyId
  ) {
    throw new Error('project_unavailable')
  }

  const archivedMembership = projectMember.status === 'archived'
  if (
    (archivedMembership && projectCompany.status !== 'exited') ||
    (!archivedMembership && projectCompany.status !== 'active')
  ) {
    throw new Error('project_unavailable')
  }

  const entitlement = archivedMembership
    ? await ctx.db
        .query('projectArchiveEntitlements')
        .withIndex('by_member', (q) => q.eq('projectMemberId', projectMember._id))
        .unique()
    : null
  if (archivedMembership && (!entitlement || entitlement.retentionStatus !== 'active')) {
    throw new Error('project_unavailable')
  }

  const groupId = input.groupId
  const groupMember = groupId && !archivedMembership
    ? await ctx.db
        .query('groupMembers')
        .withIndex('by_group_project_member', (q) =>
          q.eq('groupId', groupId).eq('projectMemberId', projectMember._id),
        )
        .unique()
    : null
  const activeChannelMember = Boolean(
    groupMember &&
      groupMember.projectId === project._id &&
      groupMember.status === 'active',
  )
  const archivedChannelMember = Boolean(
    groupId && entitlement?.channelIds.includes(groupId),
  )
  const channelMember = archivedMembership ? archivedChannelMember : activeChannelMember
  const accessMode = archivedMembership || project.status === 'archived' ? 'archive' : 'active'

  return {
    actor: input.actor,
    project,
    projectMember,
    groupId: input.groupId ?? null,
    groupMemberId: activeChannelMember ? groupMember?._id ?? null : null,
    actingCompanyId,
    capabilities: resolveProjectChannelCapabilities({
      accessProfile: 'company',
      accessMode,
      projectRole: projectMember.role,
      channelMember,
      channelActive,
      channelSteward: activeChannelMember && groupMember?.isSteward === true,
    }),
  }
}

export async function resolveProjectChannelContext(
  ctx: PolicyCtx,
  input: ProjectChannelContextInput,
) {
  const project = await ctx.db.get(input.projectId)
  if (!project) throw new Error('project_unavailable')

  const group = input.groupId ? await ctx.db.get(input.groupId) : null
  if (input.groupId && (!group || group.projectId !== project._id)) {
    throw new Error('channel_unavailable')
  }
  const channelActive = !group || !group.status || group.status === 'active'

  return resolveProjectAccessProfile(project.accessProfile) === 'company'
    ? await resolveCompanyContext(ctx, project, input, channelActive)
    : await resolveLegacyContext(ctx, project, input, channelActive)
}
