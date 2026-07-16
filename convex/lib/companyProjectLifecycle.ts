import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function requireEligibleCompanyUser(
  ctx: MutationCtx,
  companyId: Id<'companies'>,
  userId: Id<'users'>,
) {
  const [companyMember, user] = await Promise.all([
    ctx.db
      .query('companyMembers')
      .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', userId))
      .unique(),
    ctx.db.get(userId),
  ])
  if (!companyMember || companyMember.status !== 'active' || !user) {
    throw new Error('company_member_unavailable')
  }
  return { companyMember, user }
}

export async function getGeneralChannel(ctx: MutationCtx, projectId: Id<'projects'>) {
  const groups = await ctx.db
    .query('groups')
    .withIndex('by_project', (q) => q.eq('projectId', projectId))
    .collect()
  const general = groups.find((group) => group.kind === 'general')
  if (!general) throw new Error('general_channel_missing')
  return general
}

export async function createCompanyProjectMembership(
  ctx: MutationCtx,
  input: {
    projectId: Id<'projects'>
    projectCompanyId: Id<'projectCompanies'>
    companyId: Id<'companies'>
    companyDisplayName: string
    userId: Id<'users'>
    role: 'manager' | 'member'
    invitedBy: Id<'users'>
  },
) {
  const { user } = await requireEligibleCompanyUser(ctx, input.companyId, input.userId)
  const existingTerms = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_company_user_term', (q) =>
      q.eq('projectId', input.projectId).eq('companyId', input.companyId).eq('userId', input.userId),
    )
    .collect()
  const existingActive = existingTerms.find((term) => term.status === 'active')
  if (existingActive) {
    if (input.role === 'manager' && existingActive.role !== 'manager') {
      await ctx.db.patch(existingActive._id, { role: 'manager', updatedAt: Date.now() })
    }
    return existingActive
  }

  const now = Date.now()
  const projectMemberId = await ctx.db.insert('projectMembers', {
    projectId: input.projectId,
    projectCompanyId: input.projectCompanyId,
    companyId: input.companyId,
    userId: input.userId,
    role: input.role,
    status: 'active',
    term: Math.max(0, ...existingTerms.map((term) => term.term ?? 0)) + 1,
    invitedBy: input.invitedBy,
    userDisplayNameSnapshot: user.displayName,
    companyDisplayNameSnapshot: input.companyDisplayName,
    createdAt: now,
    updatedAt: now,
  })
  const general = await getGeneralChannel(ctx, input.projectId)
  await ctx.db.insert('groupMembers', {
    projectId: input.projectId,
    groupId: general._id,
    userId: input.userId,
    projectMemberId,
    status: 'active',
    isSteward: input.role === 'manager',
    createdAt: now,
    updatedAt: now,
  })
  const projectMember = await ctx.db.get(projectMemberId)
  if (!projectMember) throw new Error('project_member_creation_failed')
  return projectMember
}

export async function invalidateProjectArchiveRequests(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  now: number,
) {
  const requests = await ctx.db
    .query('projectArchiveRequests')
    .withIndex('by_project_status', (q) => q.eq('projectId', projectId).eq('status', 'pending'))
    .collect()
  await Promise.all(requests.map((request) =>
    ctx.db.patch(request._id, { status: 'stale', updatedAt: now }),
  ))
}

export async function bumpProjectParticipants(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  now: number,
) {
  const project = await ctx.db.get(projectId)
  if (!project) throw new Error('project_unavailable')
  await ctx.db.patch(project._id, {
    participantRevision: (project.participantRevision ?? 0) + 1,
    revision: (project.revision ?? 0) + 1,
    updatedAt: now,
  })
  await invalidateProjectArchiveRequests(ctx, project._id, now)
}
