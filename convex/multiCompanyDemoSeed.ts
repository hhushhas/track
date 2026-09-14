import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

const DEMO_COMPANIES = [
  { handle: 'acme-health-demo', name: 'Acme Health', members: ['olivia-owner', 'daniel-admin', 'maya-member', 'sophia-project-member'], projects: ['Patient Portal', 'Compliance Hub'] },
  { handle: 'orbit-finance-demo', name: 'Orbit Finance', members: ['olivia-owner', 'ethan-project-owner', 'noah-channel-manager', 'emma-channel-member'], projects: ['Finance Dashboard'] },
  { handle: 'northstar-labs-demo', name: 'Northstar Labs', members: ['olivia-owner', 'daniel-admin', 'maya-member', 'ethan-project-owner', 'sophia-project-member', 'noah-channel-manager', 'emma-channel-member'], projects: ['Mobile App', 'Website Redesign'] },
] as const

const DEMO_USERS = [
  ['olivia-owner', 'olivia.owner@track.local'],
  ['daniel-admin', 'daniel.admin@track.local'],
  ['maya-member', 'maya.member@track.local'],
  ['ethan-project-owner', 'ethan.project-owner@track.local'],
  ['sophia-project-member', 'sophia.project-member@track.local'],
  ['noah-channel-manager', 'noah.channel-manager@track.local'],
  ['emma-channel-member', 'emma.channel-member@track.local'],
] as const

type UserKey = (typeof DEMO_USERS)[number][0]

async function findUser(ctx: MutationCtx, email: string) {
  return await ctx.db.query('users').withIndex('by_normalized_email', (q) => q.eq('normalizedEmail', email)).unique()
}

async function ensureCompany(ctx: MutationCtx, handle: string, name: string, ownerId: Id<'users'>, now: number) {
  const existing = await ctx.db.query('companies').withIndex('by_handle', (q) => q.eq('normalizedHandle', handle)).unique()
  if (existing) return existing
  const id = await ctx.db.insert('companies', { displayName: name, normalizedHandle: handle, status: 'active', revision: 1, createdBy: ownerId, createdAt: now, updatedAt: now })
  return (await ctx.db.get(id))!
}

async function ensureCompanyMember(ctx: MutationCtx, companyId: Id<'companies'>, companyName: string, userId: Id<'users'>, role: 'owner' | 'admin' | 'member', displayName: string, now: number) {
  const existing = await ctx.db.query('companyMembers').withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', userId)).unique()
  if (existing) {
    await ctx.db.patch(existing._id, { role, status: 'active', userDisplayNameSnapshot: displayName, companyDisplayNameSnapshot: companyName, updatedAt: now })
    return existing._id
  }
  return await ctx.db.insert('companyMembers', { companyId, userId, role, status: 'active', invitedBy: userId, userDisplayNameSnapshot: displayName, companyDisplayNameSnapshot: companyName, createdAt: now, updatedAt: now })
}

async function ensureProject(ctx: MutationCtx, companyId: Id<'companies'>, ownerId: Id<'users'>, name: string, now: number, relationshipId?: Id<'relationships'>) {
  const existing = (await ctx.db.query('projects').withIndex('by_proposing_company_status', (q) => q.eq('proposingCompanyId', companyId).eq('status', 'active')).take(100)).find((project) => project.name === name)
  if (existing) return existing
  const id = await ctx.db.insert('projects', { name, description: `Seeded project for ${name} relationship and access testing.`, accessProfile: 'company', origin: relationshipId ? 'shared' : 'single_company', owningCompanyId: companyId, relationshipId, proposingCompanyId: companyId, status: 'active', participantRevision: 1, revision: 1, createdBy: ownerId, createdAt: now, updatedAt: now })
  return (await ctx.db.get(id))!
}

async function ensureProjectCompany(ctx: MutationCtx, projectId: Id<'projects'>, companyId: Id<'companies'>, acceptedBy: Id<'users'>, now: number) {
  const existing = await ctx.db.query('projectCompanies').withIndex('by_project_company_term', (q) => q.eq('projectId', projectId).eq('companyId', companyId).eq('term', 1)).unique()
  if (existing) return existing._id
  return await ctx.db.insert('projectCompanies', { projectId, companyId, term: 1, status: 'active', acceptedBy, acceptedAt: now, createdAt: now, updatedAt: now })
}

async function ensureProjectMember(ctx: MutationCtx, projectId: Id<'projects'>, companyId: Id<'companies'>, companyName: string, projectCompanyId: Id<'projectCompanies'>, userId: Id<'users'>, role: 'manager' | 'member', displayName: string, now: number) {
  const existing = await ctx.db.query('projectMembers').withIndex('by_project_company_user_term', (q) => q.eq('projectId', projectId).eq('companyId', companyId).eq('userId', userId).eq('term', 1)).unique()
  if (existing) return existing._id
  return await ctx.db.insert('projectMembers', { projectId, companyId, projectCompanyId, userId, role, status: 'active', term: 1, invitedBy: userId, userDisplayNameSnapshot: displayName, companyDisplayNameSnapshot: companyName, createdAt: now, updatedAt: now })
}

async function ensureChannel(ctx: MutationCtx, projectId: Id<'projects'>, createdBy: Id<'users'>, name: string, kind: 'general' | 'custom', now: number) {
  const existing = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', projectId)).take(50)).find((group) => group.name === name)
  if (existing) return existing
  const id = await ctx.db.insert('groups', { projectId, kind, name, status: 'active', revision: 1, createdBy, createdAt: now, updatedAt: now, nextChannelSequence: 0 })
  return (await ctx.db.get(id))!
}

async function ensureChannelMember(ctx: MutationCtx, projectId: Id<'projects'>, groupId: Id<'groups'>, member: Id<'projectMembers'>, userId: Id<'users'>, steward: boolean, now: number) {
  const existing = await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) => q.eq('groupId', groupId).eq('projectMemberId', member)).unique()
  if (existing) {
    await ctx.db.patch(existing._id, { status: 'active', isSteward: steward, updatedAt: now })
    return existing._id
  }
  return await ctx.db.insert('groupMembers', { projectId, groupId, userId, projectMemberId: member, status: 'active', isSteward: steward, createdAt: now, updatedAt: now })
}

async function seedProjectChannels(ctx: MutationCtx, projectId: Id<'projects'>, ownerId: Id<'users'>, memberRows: Array<{ memberId: Id<'projectMembers'>; userId: Id<'users'> }>, now: number) {
  const channels = [
    await ensureChannel(ctx, projectId, ownerId, 'General', 'general', now),
    await ensureChannel(ctx, projectId, ownerId, 'Delivery', 'custom', now),
    await ensureChannel(ctx, projectId, ownerId, 'Leadership', 'custom', now),
  ]
  for (const channel of channels) {
    for (const row of memberRows) {
      const steward = channel.name === 'Delivery' || (channel.name === 'Leadership' && row.userId === ownerId)
      await ensureChannelMember(ctx, projectId, channel._id, row.memberId, row.userId, steward, now)
    }
  }
  return channels.length
}

export const seed = internalMutation({
  args: {},
  returns: v.object({ companies: v.number(), projects: v.number(), channels: v.number(), companyMembers: v.number(), projectMembers: v.number(), relationships: v.number() }),
  handler: async (ctx) => {
    const now = Date.now()
    const users = new Map<UserKey, NonNullable<Awaited<ReturnType<typeof findUser>>>>()
    for (const [key, email] of DEMO_USERS) {
      const user = await findUser(ctx, email)
      if (!user) throw new Error(`multi_company_demo_user_missing:${email}`)
      users.set(key, user)
    }
    const owner = users.get('olivia-owner')!
    const companies = new Map<string, NonNullable<Awaited<ReturnType<typeof ensureCompany>>>>()
    for (const spec of DEMO_COMPANIES) {
      const company = await ensureCompany(ctx, spec.handle, spec.name, owner._id, now)
      companies.set(spec.handle, company)
      for (const key of spec.members) {
        const user = users.get(key)!
        await ensureCompanyMember(ctx, company._id, company.displayName, user._id, key === 'olivia-owner' ? 'owner' : key === 'daniel-admin' ? 'admin' : 'member', user.displayName ?? key, now)
      }
    }

    const acme = companies.get('acme-health-demo')!
    const orbit = companies.get('orbit-finance-demo')!
    let relationship = (await ctx.db.query('relationships').withIndex('by_creating_company', (q) => q.eq('createdByCompanyId', acme._id)).take(50)).find((item) => item.name === 'Acme–Orbit Partnership' && item.status === 'active')
    if (!relationship) {
      const relationshipId = await ctx.db.insert('relationships', { name: 'Acme–Orbit Partnership', status: 'active', createdBy: owner._id, createdByCompanyId: acme._id, participantRevision: 1, revision: 1, createdAt: now, updatedAt: now })
      relationship = (await ctx.db.get(relationshipId))!
      for (const company of [acme, orbit]) await ctx.db.insert('relationshipCompanies', { relationshipId, companyId: company._id, term: 1, status: 'active', acceptedBy: owner._id, acceptedAt: now, createdAt: now, updatedAt: now })
    }

    let projectCount = 0
    let channelCount = 0
    let projectMemberCount = 0
    for (const spec of DEMO_COMPANIES) {
      const company = companies.get(spec.handle)!
      for (const projectName of spec.projects) {
        const project = await ensureProject(ctx, company._id, owner._id, projectName, now)
        const projectCompanyId = await ensureProjectCompany(ctx, project._id, company._id, owner._id, now)
        const projectMemberRows: Array<{ memberId: Id<'projectMembers'>; userId: Id<'users'> }> = []
        for (const key of spec.members) {
          const member = await ensureProjectMember(ctx, project._id, company._id, company.displayName, projectCompanyId, users.get(key)!._id, key === 'olivia-owner' ? 'manager' : 'member', users.get(key)!.displayName ?? key, now)
          projectMemberRows.push({ memberId: member, userId: users.get(key)!._id })
          projectMemberCount += 1
        }
        channelCount += await seedProjectChannels(ctx, project._id, owner._id, projectMemberRows, now)
        projectCount += 1
      }
    }

    const sharedProject = await ensureProject(ctx, acme._id, owner._id, 'Partner Launch', now, relationship._id)
    const sharedMemberRows: Array<{ memberId: Id<'projectMembers'>; userId: Id<'users'> }> = []
    for (const [company, keys] of [[acme, ['olivia-owner', 'daniel-admin', 'maya-member'] as const], [orbit, ['olivia-owner', 'ethan-project-owner', 'emma-channel-member'] as const]] as const) {
      const projectCompanyId = await ensureProjectCompany(ctx, sharedProject._id, company._id, owner._id, now)
      for (const key of keys) {
        const memberId = await ensureProjectMember(ctx, sharedProject._id, company._id, company.displayName, projectCompanyId, users.get(key)!._id, key === 'olivia-owner' ? 'manager' : 'member', users.get(key)!.displayName ?? key, now)
        sharedMemberRows.push({ memberId, userId: users.get(key)!._id })
        projectMemberCount += 1
      }
    }
    channelCount += await seedProjectChannels(ctx, sharedProject._id, owner._id, sharedMemberRows, now)
    return { companies: companies.size, projects: projectCount + 1, channels: channelCount, companyMembers: DEMO_COMPANIES.reduce((sum, item) => sum + item.members.length, 0), projectMembers: projectMemberCount, relationships: 1 }
  },
})
