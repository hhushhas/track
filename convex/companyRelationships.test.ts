import { convexTest } from 'convex-test'
import { beforeEach, describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

type TestBackend = ReturnType<typeof convexTest>

beforeEach(() => {
  process.env.TRACK_COMPANY_MODEL_ENABLED = 'true'
})

describe('Company model authorization and lifecycle', () => {
  it('binds caller-supplied actor ids to the authenticated user', async () => {
    const t = convexTest(schema, modules)
    const alice = await seedUser(t, 'alice')
    const bob = await seedUser(t, 'bob')
    const { groupId, projectId } = await seedLegacyProject(t, alice)

    await expect(asUser(t, bob).mutation(api.messages.send, {
      authorId: alice,
      body: 'spoofed',
      groupId,
      projectId,
    })).rejects.toThrow('actor_mismatch')

    expect(await t.run(async (ctx) => await ctx.db.query('messages').collect())).toHaveLength(0)
  })

  it('activates a shared Project only after acceptance and enrolls each manager in General only', async () => {
    const fixture = await seedSharedProject()
    const { a, aCompany, b, bCompany, projectId, t } = fixture
    const state = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const groups = await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
      const memberships = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
      const channelMemberships = await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', groups[0]._id)).collect()
      return { project, groups, memberships, channelMemberships }
    })

    expect(state.project?.status).toBe('active')
    expect(state.groups.map((group) => group.kind)).toEqual(['general'])
    expect(state.memberships).toEqual(expect.arrayContaining([
      expect.objectContaining({ companyId: aCompany, role: 'manager', userId: a }),
      expect.objectContaining({ companyId: bCompany, role: 'manager', userId: b }),
    ]))
    expect(state.channelMemberships).toHaveLength(2)
  })

  it('keeps Acting Company memberships isolated for a multi-Company user', async () => {
    const t = convexTest(schema, modules)
    const user = await seedUser(t, 'multi')
    const firstCompany = await createCompany(t, user, 'First Company', 'first-company')
    const secondCompany = await createCompany(t, user, 'Second Company', 'second-company')
    const firstProject = await seedCompanyProject(t, user, firstCompany, 'First Project')
    const secondProject = await seedCompanyProject(t, user, secondCompany, 'Second Project')

    const actor = asUser(t, user)
    const first = await actor.query(api.mobile.listProjects, { actingCompanyId: firstCompany, userId: user })
    const second = await actor.query(api.mobile.listProjects, { actingCompanyId: secondCompany, userId: user })

    expect(first.map((item) => item.project._id)).toEqual([firstProject])
    expect(second.map((item) => item.project._id)).toEqual([secondProject])
  })

  it('suspends all Company access and restores only still-valid represented memberships', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'owner')
    const companyId = await createCompany(t, owner, 'Recovery Company', 'recovery-company')
    const projectId = await seedCompanyProject(t, owner, companyId, 'Recovery Project')
    const actor = asUser(t, owner)

    await actor.mutation(api.companies.setSuspended, { companyId, suspended: true })
    await expect(actor.query(api.mobile.listProjects, { actingCompanyId: companyId, userId: owner })).rejects.toThrow('company_unavailable')

    await actor.mutation(api.companies.setSuspended, { companyId, suspended: false })
    const restored = await actor.query(api.mobile.listProjects, { actingCompanyId: companyId, userId: owner })
    expect(restored.map((item) => item.project._id)).toEqual([projectId])
  })

  it('requires current unanimous participant approval and rejects stale archive votes', async () => {
    const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
    const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
    const aMembership = memberships.find((membership) => membership.companyId === aCompany)!
    const bMembership = memberships.find((membership) => membership.companyId === bCompany)!
    const requestId = await asUser(t, a).mutation(api.projectArchives.request, {
      actingCompanyId: aCompany,
      idempotencyKey: 'archive-1',
      operation: 'archive',
      projectId,
      projectMemberId: aMembership._id,
    })

    await asUser(t, a).mutation(api.projectArchives.approve, {
      actingCompanyId: aCompany,
      projectId,
      projectMemberId: aMembership._id,
      requestId,
    })
    expect((await t.run(async (ctx) => await ctx.db.get(projectId)))?.status).toBe('archive_pending')

    await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      await ctx.db.patch(projectId, { participantRevision: (project?.participantRevision ?? 0) + 1 })
    })
    await asUser(t, b).mutation(api.projectArchives.approve, {
      actingCompanyId: bCompany,
      projectId,
      projectMemberId: bMembership._id,
      requestId,
    })
    expect((await t.run(async (ctx) => await ctx.db.get(requestId)))?.status).toBe('stale')
  })

  it('upgrades a legacy Project only from explicit mappings and preserves exact Group membership', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'upgrade-owner')
    const member = await seedUser(t, 'upgrade-member')
    const companyId = await createCompany(t, owner, 'Upgrade Company', 'upgrade-company')
    await addCompanyMember(t, companyId, member)
    const { groupId, projectId } = await seedLegacyProject(t, owner, member)
    const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
    const before = await t.run(async (ctx) => (await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', groupId)).collect()).map((row) => row.userId).sort())
    const actor = asUser(t, owner)
    const upgradeId = await actor.mutation(api.companyMigration.initiate, {
      idempotencyKey: 'upgrade-1',
      initiatingCompanyId: companyId,
      mappings: memberships.map((membership) => ({
        companyId,
        neutralRole: membership.userId === owner ? 'manager' as const : 'member' as const,
        projectMemberId: membership._id,
      })),
      projectId,
    })
    await actor.mutation(api.companyMigration.activate, { upgradeId })

    const after = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const groupMembers = await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', groupId)).collect()
      return { project, groupMembers }
    })
    expect(after.project).toMatchObject({ accessProfile: 'company', origin: 'single_company', status: 'active' })
    expect(after.groupMembers.map((row) => row.userId).sort()).toEqual(before)
    expect(after.groupMembers.every((row) => row.projectMemberId && row.status === 'active')).toBe(true)
  })

  it('requires a verified exit snapshot, creates exact archives, and terminally archives after the last exit', async () => {
    const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
    const prepared = await asUser(t, a).mutation(api.projectExit.prepare, { actingCompanyId: aCompany, projectId })
    expect(await asUser(t, a).mutation(api.projectExit.prepare, { actingCompanyId: aCompany, projectId })).toBe(prepared)
    await expect(asUser(t, a).mutation(api.projectExit.finalize, { actingCompanyId: aCompany, projectId })).rejects.toThrow('exit_snapshot_not_verified')
    await verifyPendingSnapshot(t, projectId, aCompany)
    await asUser(t, a).mutation(api.projectExit.finalize, { actingCompanyId: aCompany, projectId })

    const firstExit = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const aMember = (await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()).find((member) => member.companyId === aCompany)
      const entitlement = aMember ? await ctx.db.query('projectArchiveEntitlements').withIndex('by_member', (q) => q.eq('projectMemberId', aMember._id)).unique() : null
      return { aMember, entitlement, project }
    })
    expect(firstExit.project?.status).toBe('active')
    expect(firstExit.aMember?.status).toBe('archived')
    expect(firstExit.entitlement?.channelIds).toHaveLength(1)

    await asUser(t, b).mutation(api.projectExit.prepare, { actingCompanyId: bCompany, projectId })
    await verifyPendingSnapshot(t, projectId, bCompany)
    await asUser(t, b).mutation(api.projectExit.finalize, { actingCompanyId: bCompany, projectId })
    expect(await t.run(async (ctx) => await ctx.db.get(projectId))).toMatchObject({
      archiveReason: 'no_active_participants',
      status: 'archived',
    })
  })
})

async function seedUser(t: TestBackend, subject: string) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      createdAt: now,
      displayName: subject,
      email: `${subject}@example.test`,
      googleSubject: subject,
      normalizedEmail: `${subject}@example.test`,
      twoFactorEnabled: false,
      updatedAt: now,
    })
    await ctx.db.patch(userId, { authUserId: String(userId) })
    return userId
  })
}

function asUser(t: TestBackend, userId: Id<'users'>) {
  return t.withIdentity({ subject: String(userId) })
}

async function createCompany(t: TestBackend, userId: Id<'users'>, displayName: string, handle: string) {
  return await asUser(t, userId).mutation(api.companies.create, { displayName, handle })
}

async function addCompanyMember(t: TestBackend, companyId: Id<'companies'>, userId: Id<'users'>) {
  const now = Date.now()
  await t.run(async (ctx) => {
    const [company, user] = await Promise.all([ctx.db.get(companyId), ctx.db.get(userId)])
    await ctx.db.insert('companyMembers', {
      companyId,
      companyDisplayNameSnapshot: company!.displayName,
      createdAt: now,
      role: 'member',
      status: 'active',
      updatedAt: now,
      userDisplayNameSnapshot: user!.displayName,
      userId,
    })
  })
}

async function seedLegacyProject(t: TestBackend, ownerId: Id<'users'>, memberId?: Id<'users'>) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    const projectId = await ctx.db.insert('projects', { createdAt: now, createdBy: ownerId, name: 'Legacy', revision: 1, updatedAt: now })
    const groupId = await ctx.db.insert('groups', { createdAt: now, createdBy: ownerId, kind: 'general', name: 'General', projectId, updatedAt: now })
    const users = memberId ? [ownerId, memberId] : [ownerId]
    for (const userId of users) {
      await ctx.db.insert('projectMembers', { createdAt: now, projectId, role: userId === ownerId ? 'owner' : 'staff', updatedAt: now, userId })
      await ctx.db.insert('groupMembers', { createdAt: now, groupId, projectId, updatedAt: now, userId })
    }
    return { groupId, projectId }
  })
}

async function seedCompanyProject(t: TestBackend, userId: Id<'users'>, companyId: Id<'companies'>, name: string) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    const projectId = await ctx.db.insert('projects', {
      accessProfile: 'company', createdAt: now, createdBy: userId, name, origin: 'single_company',
      participantRevision: 1, revision: 1, status: 'active', updatedAt: now,
    })
    const projectCompanyId = await ctx.db.insert('projectCompanies', {
      acceptedAt: now, acceptedBy: userId, companyId, createdAt: now, projectId, status: 'active', term: 1, updatedAt: now,
    })
    const projectMemberId = await ctx.db.insert('projectMembers', {
      companyDisplayNameSnapshot: name, companyId, createdAt: now, projectCompanyId, projectId,
      role: 'manager', status: 'active', term: 1, updatedAt: now, userDisplayNameSnapshot: name, userId,
    })
    const groupId = await ctx.db.insert('groups', { createdAt: now, createdBy: userId, kind: 'general', name: 'General', projectId, revision: 1, status: 'active', updatedAt: now })
    await ctx.db.insert('groupMembers', { createdAt: now, groupId, isSteward: true, projectId, projectMemberId, status: 'active', updatedAt: now, userId })
    return projectId
  })
}

async function seedSharedProject() {
  const t = convexTest(schema, modules)
  const a = await seedUser(t, 'company-a-owner')
  const b = await seedUser(t, 'company-b-owner')
  const aCompany = await createCompany(t, a, 'Company A', 'company-a')
  const bCompany = await createCompany(t, b, 'Company B', 'company-b')
  const created = await asUser(t, a).mutation(api.relationships.create, { actingCompanyId: aCompany, name: 'Partner Network', targetCompanyId: bCompany })
  await asUser(t, b).mutation(api.relationships.decideInvitation, { actingCompanyId: bCompany, decision: 'accept', invitationId: created.invitationId })
  const proposed = await asUser(t, a).mutation(api.sharedProjects.propose, {
    actingCompanyId: aCompany,
    initialMembers: [{ role: 'manager', userId: a }],
    name: 'Shared Project',
    relationshipId: created.relationshipId,
    targetCompanyIds: [bCompany],
  })
  await asUser(t, b).mutation(api.sharedProjects.decideInvitation, {
    actingCompanyId: bCompany,
    decision: 'accept',
    initialMembers: [{ role: 'manager', userId: b }],
    invitationId: proposed.invitations[0].invitationId,
  })
  return { a, aCompany, b, bCompany, projectId: proposed.projectId, t }
}

async function verifyPendingSnapshot(t: TestBackend, projectId: Id<'projects'>, companyId: Id<'companies'>) {
  await t.run(async (ctx) => {
    const terms = (await ctx.db.query('projectCompanies').collect()).filter((term) => term.projectId === projectId && term.companyId === companyId)
    const pending = terms.find((term) => term.status === 'exit_pending')!
    await ctx.db.patch(pending._id, {
      memorySnapshotManifest: { sources: [] },
      memorySnapshotManifestHash: `verified-${companyId}`,
      memorySnapshotPath: `snapshots/${projectId}/${companyId}`,
      memorySnapshotStatus: 'verified',
    })
  })
}
