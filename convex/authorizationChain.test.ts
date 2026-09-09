import { convexTest } from 'convex-test'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

type TestBackend = ReturnType<typeof convexTest>

beforeEach(() => {
  vi.stubEnv('TRACK_COMPANY_MODEL_ENABLED', 'true')
  vi.stubEnv('TRACK_TASKS_ENABLED', 'true')
  vi.stubEnv('TRACK_THREADS_ENABLED', 'true')
})

afterEach(() => vi.unstubAllEnvs())

describe('company to project to channel authorization chain', () => {
  it('separates member-safe company data from administration and enforces roles server-side', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'owner')
    const admin = await seedUser(t, 'admin')
    const member = await seedUser(t, 'member')
    const companyId = await createCompany(t, owner, 'Acme', 'acme')
    const adminMembershipId = await addCompanyMember(t, companyId, admin, 'admin')
    const memberMembershipId = await addCompanyMember(t, companyId, member, 'member')

    expect(await asUser(t, member).query(api.companies.getBasic, { companyId })).toMatchObject({
      company: { displayName: 'Acme', normalizedHandle: 'acme', status: 'active' },
      membership: { role: 'member', status: 'active' },
    })
    await expect(asUser(t, member).query(api.companies.getAdministration, { companyId }))
      .rejects.toThrow('company_admin_required')
    await expect(asUser(t, member).mutation(api.companies.updateProfile, { companyId, displayName: 'Nope' }))
      .rejects.toThrow('company_admin_required')
    await expect(asUser(t, member).mutation(api.companies.inviteMember, {
      companyId, email: 'new@example.test', role: 'member',
    })).rejects.toThrow('company_admin_required')
    await expect(asUser(t, member).mutation(api.companies.updateMember, {
      companyId, companyMemberId: adminMembershipId, role: 'member',
    })).rejects.toThrow('company_admin_required')
    await expect(asUser(t, member).mutation(api.relationships.create, {
      actingCompanyId: companyId, name: 'Forbidden', targetCompanyId: companyId,
    })).rejects.toThrow('company_admin_required')
    const ownerMembership = await membershipFor(t, companyId, owner)
    await expect(asUser(t, owner).mutation(api.companies.updateMember, {
      companyId, companyMemberId: ownerMembership!._id, status: 'removed',
    })).rejects.toThrow('last_company_owner')

    await asUser(t, admin).mutation(api.companies.updateProfile, {
      companyId, displayName: 'Acme Studio', description: 'A private workspace.', handle: 'acme-studio',
    })
    await t.mutation(internal.companies.propagateDisplayNameSnapshots, {
      companyId, cursor: null, displayName: 'Acme', table: 'companyMembers',
    })
    expect((await membershipFor(t, companyId, member))?.companyDisplayNameSnapshot)
      .toBe('Acme Studio')
    await asUser(t, admin).mutation(api.companies.updateMember, {
      companyId, companyMemberId: memberMembershipId, role: 'admin',
    })
    await expect(asUser(t, admin).mutation(api.companies.updateMember, {
      companyId, companyMemberId: memberMembershipId, role: 'owner',
    })).rejects.toThrow('company_owner_required')
    await expect(asUser(t, admin).mutation(api.companies.close, { companyId, retentionConfirmed: true }))
      .rejects.toThrow('company_owner_required')

    const administration = await asUser(t, owner).query(api.companies.getAdministration, { companyId })
    expect(administration.company).toMatchObject({
      displayName: 'Acme Studio', description: 'A private workspace.', normalizedHandle: 'acme-studio',
    })
    expect(administration.members.find((item) => item.membership.userId === member)?.user?.email)
      .toBe('member@example.test')
  })

  it('validates, deduplicates, expires, revokes, and safely consumes company invitations', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'invite-owner')
    const recipient = await seedUser(t, 'invite-recipient')
    const companyId = await createCompany(t, owner, 'Invites', 'invites')
    const actor = asUser(t, owner)

    await expect(actor.mutation(api.companies.inviteMember, {
      companyId, email: 'not-an-email', role: 'member',
    })).rejects.toThrow('email_invalid')
    const first = await actor.mutation(api.companies.inviteMember, {
      companyId, email: 'Invite-Recipient@Example.Test', role: 'admin',
    })
    const duplicate = await actor.mutation(api.companies.inviteMember, {
      companyId, email: 'invite-recipient@example.test', role: 'admin',
    })
    expect(duplicate).toEqual({ invitationId: first.invitationId, token: null })
    await asUser(t, recipient).mutation(api.companies.decideInvitation, {
      invitationId: first.invitationId, decision: 'accept',
    })
    expect(await asUser(t, recipient).mutation(api.companies.decideInvitation, {
      invitationId: first.invitationId, decision: 'accept',
    })).toBe(first.invitationId)
    const accepted = await membershipFor(t, companyId, recipient)
    expect(accepted).toMatchObject({ role: 'admin', status: 'active' })
    expect(await t.run(async (ctx) => ctx.db.query('projectMembers').withIndex('by_user', (q) => q.eq('userId', recipient)).collect()))
      .toHaveLength(0)

    const revoked = await actor.mutation(api.companies.inviteMember, {
      companyId, email: 'revoked@example.test', role: 'member',
    })
    await actor.mutation(api.companies.revokeInvitation, { companyId, invitationId: revoked.invitationId })
    expect(await actor.mutation(api.companies.revokeInvitation, { companyId, invitationId: revoked.invitationId }))
      .toBe(revoked.invitationId)

    const declinedUser = await seedUser(t, 'declined')
    const declined = await actor.mutation(api.companies.inviteMember, {
      companyId, email: 'declined@example.test', role: 'member',
    })
    await asUser(t, declinedUser).mutation(api.companies.decideInvitation, {
      invitationId: declined.invitationId, decision: 'decline',
    })
    expect(await asUser(t, declinedUser).mutation(api.companies.decideInvitation, {
      invitationId: declined.invitationId, decision: 'decline',
    })).toBe(declined.invitationId)
    await expect(asUser(t, recipient).mutation(api.companies.decideInvitation, {
      invitationId: declined.invitationId, decision: 'accept',
    })).rejects.toThrow('invitation_unavailable')

    const expiredUser = await seedUser(t, 'expired')
    const expired = await actor.mutation(api.companies.inviteMember, {
      companyId, email: 'expired@example.test', role: 'member',
    })
    await t.run(async (ctx) => ctx.db.patch(expired.invitationId, { expiresAt: Date.now() - 1 }))
    expect(await asUser(t, expiredUser).mutation(api.companies.decideInvitation, {
      invitationId: expired.invitationId, decision: 'accept',
    })).toEqual({ invitationId: expired.invitationId, status: 'expired' })
    const expiration = await t.run(async (ctx) => ({
      invitation: await ctx.db.get(expired.invitationId),
      audits: await ctx.db.query('auditEvents').collect(),
    }))
    expect(expiration.invitation?.status).toBe('expired')
    expect(expiration.audits.some((event) => event.action === 'company_invitation.expired')).toBe(true)
  })

  it('creates a complete company project without granting every company admin project access', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'project-owner')
    const admin = await seedUser(t, 'company-admin')
    const companyId = await createCompany(t, owner, 'Projects Co', 'projects-co')
    await addCompanyMember(t, companyId, admin, 'admin')

    const created = await asUser(t, owner).mutation(api.sharedProjects.createCompanyProject, {
      actingCompanyId: companyId, name: 'Launch', description: 'Launch planning',
    })
    const records = await t.run(async (ctx) => ({
      project: await ctx.db.get(created.projectId),
      projectCompany: await ctx.db.get(created.projectCompanyId),
      projectMember: await ctx.db.get(created.projectMemberId),
      group: await ctx.db.get(created.groupId),
      groupMember: await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) =>
        q.eq('groupId', created.groupId).eq('projectMemberId', created.projectMemberId)).unique(),
    }))
    expect(records.project).toMatchObject({ accessProfile: 'company', origin: 'single_company', status: 'active', createdBy: owner })
    expect(records.projectCompany).toMatchObject({ companyId, projectId: created.projectId, status: 'active' })
    expect(records.projectMember).toMatchObject({ companyId, projectCompanyId: created.projectCompanyId, role: 'manager', status: 'active', userId: owner })
    expect(records.group).toMatchObject({ kind: 'general', name: 'General', projectId: created.projectId, status: 'active' })
    expect(records.groupMember).toMatchObject({ isSteward: true, status: 'active', userId: owner })

    expect((await asUser(t, owner).query(api.projects.listAccessible, {})).map((item) => item.project._id))
      .toContain(created.projectId)
    expect((await asUser(t, admin).query(api.projects.listAccessible, {})).map((item) => item.project._id))
      .not.toContain(created.projectId)
    const adminProjectMemberId = await asUser(t, owner).mutation(api.sharedProjects.addMember, {
      actingCompanyId: companyId,
      projectId: created.projectId,
      projectMemberId: created.projectMemberId,
      role: 'member',
      userId: admin,
    })
    await t.run(async (ctx) => {
      const now = Date.now()
      const foreignCompanyId = await ctx.db.insert('companies', {
        createdAt: now, createdBy: owner, displayName: 'Foreign projects',
        normalizedHandle: 'foreign-projects', revision: 1, status: 'active', updatedAt: now,
      })
      for (let index = 0; index < 201; index += 1) {
        const foreignProjectId = await ctx.db.insert('projects', {
          accessProfile: 'company', createdAt: now, createdBy: owner,
          name: `Foreign ${index}`, origin: 'single_company', participantRevision: 1,
          proposingCompanyId: foreignCompanyId, revision: 1, status: 'active', updatedAt: now,
        })
        await ctx.db.insert('projectMembers', {
          companyId: foreignCompanyId, createdAt: now, projectId: foreignProjectId,
          role: 'member', status: 'removed', updatedAt: now, userId: admin,
        })
      }
    })
    expect(await asUser(t, admin).query(api.sharedProjects.listForActingCompany, { actingCompanyId: companyId }))
      .toHaveLength(1)
    expect(await asUser(t, admin).query(api.sharedProjects.getOverview, {
      actingCompanyId: companyId,
      projectId: created.projectId,
      projectMemberId: adminProjectMemberId,
    })).toMatchObject({
      companies: [{ displayName: 'Projects Co', status: 'active' }],
      managers: [{ displayName: 'project-owner' }],
      memberCount: 2,
      memberCountTruncated: false,
    })
    await expect(asUser(t, admin).mutation(api.sharedProjects.updateDetails, {
      actingCompanyId: companyId, projectId: created.projectId,
      projectMemberId: created.projectMemberId, name: 'Unauthorized',
    })).rejects.toThrow('project_unavailable')
    await asUser(t, owner).mutation(api.sharedProjects.updateDetails, {
      actingCompanyId: companyId, projectId: created.projectId,
      projectMemberId: created.projectMemberId, name: 'Launch plan', label: 'FY27',
    })
    const updated = await t.run(async (ctx) => ({
      project: await ctx.db.get(created.projectId),
      audits: await ctx.db.query('auditEvents').collect(),
    }))
    expect(updated.project).toMatchObject({ name: 'Launch plan', clientLabel: 'FY27' })
    expect(updated.audits.some((event) => event.action === 'project.updated')).toBe(true)

    await asUser(t, owner).mutation(api.companies.updateProfile, {
      companyId, displayName: 'Projects Company',
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await t.finishInProgressScheduledFunctions()
    expect(await t.run(async (ctx) => (await ctx.db.get(created.projectMemberId))?.companyDisplayNameSnapshot))
      .toBe('Projects Company')

    const archiveRequestId = await asUser(t, owner).mutation(api.projectArchives.request, {
      actingCompanyId: companyId,
      idempotencyKey: 'launch-archive',
      operation: 'archive',
      projectId: created.projectId,
      projectMemberId: created.projectMemberId,
    })
    await expect(asUser(t, admin).query(api.projectArchives.listPending, {
      actingCompanyId: companyId,
      projectId: created.projectId,
      projectMemberId: created.projectMemberId,
    })).rejects.toThrow('project_unavailable')
    await expect(asUser(t, admin).mutation(api.projectArchives.approve, {
      actingCompanyId: companyId,
      projectId: created.projectId,
      projectMemberId: created.projectMemberId,
      requestId: archiveRequestId,
    })).rejects.toThrow('project_unavailable')
  })

  it('makes a shared-project proposer an immediate manager and General-channel member', async () => {
    const t = convexTest(schema, modules)
    const proposer = await seedUser(t, 'shared-proposer')
    const partner = await seedUser(t, 'shared-partner')
    const proposerCompany = await createCompany(t, proposer, 'Proposer Co', 'proposer-co')
    const partnerCompany = await createCompany(t, partner, 'Partner Co', 'partner-co')
    const relationship = await asUser(t, proposer).mutation(api.relationships.create, {
      actingCompanyId: proposerCompany, name: 'Delivery partners', targetCompanyId: partnerCompany,
    })
    await asUser(t, partner).mutation(api.relationships.decideInvitation, {
      actingCompanyId: partnerCompany, decision: 'accept', invitationId: relationship.invitationId,
    })
    const proposal = await asUser(t, proposer).mutation(api.sharedProjects.propose, {
      actingCompanyId: proposerCompany, initialMembers: [], name: 'Joint launch',
      relationshipId: relationship.relationshipId, targetCompanyIds: [partnerCompany],
    })
    const records = await t.run(async (ctx) => {
      const projectMember = (await ctx.db.query('projectMembers').withIndex('by_project', (q) =>
        q.eq('projectId', proposal.projectId)).collect()).find((member) => member.userId === proposer)
      const general = (await ctx.db.query('groups').withIndex('by_project', (q) =>
        q.eq('projectId', proposal.projectId)).collect()).find((group) => group.kind === 'general')
      const groupMember = projectMember && general ? await ctx.db.query('groupMembers')
        .withIndex('by_group_project_member', (q) => q.eq('groupId', general._id).eq('projectMemberId', projectMember._id)).unique() : null
      return { general, groupMember, projectMember }
    })
    expect(records.projectMember).toMatchObject({ companyId: proposerCompany, role: 'manager', status: 'active' })
    expect(records.groupMember).toMatchObject({ isSteward: true, status: 'active' })
    expect((await asUser(t, proposer).query(api.projects.listAccessible, {})).map((item) => item.project._id))
      .toContain(proposal.projectId)
    await asUser(t, partner).mutation(api.relationships.leave, {
      actingCompanyId: partnerCompany, relationshipId: relationship.relationshipId,
    })
    expect((await asUser(t, proposer).query(api.projects.listAccessible, {})).map((item) => item.project._id))
      .not.toContain(proposal.projectId)
  })

  it('enforces project and channel memberships, lifecycle states, normalized names, and manager synchronization', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'channel-owner')
    const member = await seedUser(t, 'channel-member')
    const outsider = await seedUser(t, 'outsider')
    const companyId = await createCompany(t, owner, 'Channels Co', 'channels-co')
    await addCompanyMember(t, companyId, member)
    const created = await asUser(t, owner).mutation(api.sharedProjects.createCompanyProject, {
      actingCompanyId: companyId, name: 'Channels',
    })
    const memberProjectId = await asUser(t, owner).mutation(api.sharedProjects.addMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      role: 'member', userId: member,
    })
    const channelId = await asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: '# Design Discussion ', ownCompanyMemberIds: [memberProjectId],
    })
    expect((await t.run(async (ctx) => ctx.db.get(channelId)))?.name).toBe('design-discussion')
    await t.run(async (ctx) => ctx.db.patch(channelId, { name: 'Design Discussion' }))
    await expect(asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: 'design discussion', ownCompanyMemberIds: [],
    })).rejects.toThrow('channel_name_unavailable')
    await t.run(async (ctx) => ctx.db.patch(channelId, { status: 'archived', updatedAt: Date.now() }))
    await expect(asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: 'design discussion', ownCompanyMemberIds: [],
    })).rejects.toThrow('channel_name_unavailable')
    await t.run(async (ctx) => ctx.db.patch(channelId, { status: 'active', updatedAt: Date.now() }))
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('groups', {
        projectId: created.projectId, kind: 'custom', name: 'Q&A ✨', status: 'active',
        revision: 1, createdBy: owner, createdAt: now, updatedAt: now,
      })
    })
    await expect(asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: 'release-notes', ownCompanyMemberIds: [],
    })).resolves.toBeDefined()
    await expect(asUser(t, member).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
      name: 'engineering', ownCompanyMemberIds: [],
    })).rejects.toThrow('project_manager_required')

    await asUser(t, owner).mutation(api.sharedProjects.updateMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      targetProjectMemberId: memberProjectId, role: 'manager',
    })
    expect(await asUser(t, member).query(api.sharedProjects.listEligibleCompanyMembers, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ membership: expect.objectContaining({ userId: owner }) }),
      expect.objectContaining({ membership: expect.objectContaining({ userId: member }) }),
    ]))
    const promotedChannel = await t.run(async (ctx) => ctx.db.query('groupMembers')
      .withIndex('by_group_project_member', (q) => q.eq('groupId', channelId).eq('projectMemberId', memberProjectId)).unique())
    expect(promotedChannel?.isSteward).toBe(true)
    await asUser(t, member).mutation(api.channels.update, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
      groupId: channelId, name: 'Engineering',
    })
    expect((await t.run(async (ctx) => ctx.db.get(channelId)))?.name).toBe('engineering')
    await asUser(t, owner).mutation(api.sharedProjects.updateMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      targetProjectMemberId: memberProjectId, role: 'member',
    })
    await asUser(t, owner).mutation(api.channels.updateOwnCompanyMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      groupId: channelId, steward: true, targetProjectMemberId: memberProjectId,
    })
    await asUser(t, member).mutation(api.channels.update, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
      groupId: channelId, name: 'member-managed-channel',
    })

    await asUser(t, owner).mutation(api.channels.updateOwnCompanyMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      groupId: channelId, targetProjectMemberId: memberProjectId, status: 'suspended',
    })
    expect((await asUser(t, member).query(api.channels.list, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
    })).map((entry) => 'channel' in entry ? entry.channel._id : entry._id)).not.toContain(channelId)
    await asUser(t, owner).mutation(api.channels.updateOwnCompanyMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      groupId: channelId, targetProjectMemberId: memberProjectId, status: 'removed',
    })
    await asUser(t, owner).mutation(api.sharedProjects.updateMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      targetProjectMemberId: memberProjectId, status: 'suspended',
    })
    await asUser(t, owner).mutation(api.sharedProjects.updateMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      targetProjectMemberId: memberProjectId, status: 'active',
    })
    const restoredMemberships = await asUser(t, member).query(api.channels.list, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
    })
    expect(restoredMemberships.map((entry) => 'channel' in entry ? entry.channel._id : entry._id))
      .toContain(created.groupId)
    expect(restoredMemberships.map((entry) => 'channel' in entry ? entry.channel._id : entry._id))
      .not.toContain(channelId)
    await expect(asUser(t, outsider).query(api.projects.listAccessible, {})).resolves.toEqual([])

    await t.run(async (ctx) => ctx.db.patch(created.projectId, { status: 'archive_pending', updatedAt: Date.now() }))
    await expect(asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: 'blocked-during-archive', ownCompanyMemberIds: [],
    })).rejects.toThrow('project_manager_required')
  })

  it('lists project evidence only when both project and source-channel access pass', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const owner = await seedUser(t, 'evidence-owner')
    const member = await seedUser(t, 'evidence-member')
    const outsider = await seedUser(t, 'evidence-outsider')
    const companyId = await createCompany(t, owner, 'Evidence Co', 'evidence-co')
    await addCompanyMember(t, companyId, member)
    const created = await asUser(t, owner).mutation(api.sharedProjects.createCompanyProject, {
      actingCompanyId: companyId, name: 'Evidence',
    })
    const memberProjectId = await asUser(t, owner).mutation(api.sharedProjects.addMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      role: 'member', userId: member,
    })
    const idempotentMessageArgs = {
      actingCompanyId: companyId,
      authorId: owner,
      body: 'Welcome @evidence-member',
      groupId: created.groupId,
      idempotencyKey: 'evidence-welcome-message',
      mentionedProjectMemberIds: [memberProjectId],
      mentions: [member],
      projectId: created.projectId,
      projectMemberId: created.projectMemberId,
    }
    const idempotentMessageId = await asUser(t, owner).mutation(
      api.messages.send,
      idempotentMessageArgs,
    )
    const memberGeneralMembershipId = await t.run(async (ctx) => {
      const membership = await ctx.db.query('groupMembers')
        .withIndex('by_group_project_member', (q) =>
          q.eq('groupId', created.groupId).eq('projectMemberId', memberProjectId),
        )
        .unique()
      if (!membership) throw new Error('test_group_membership_missing')
      await ctx.db.patch(membership._id, { status: 'suspended', updatedAt: Date.now() })
      return membership._id
    })
    await expect(asUser(t, owner).mutation(api.messages.send, idempotentMessageArgs))
      .resolves.toBe(idempotentMessageId)
    await t.run(async (ctx) => {
      await ctx.db.patch(memberGeneralMembershipId, { status: 'active', updatedAt: Date.now() })
    })
    const privateChannelId = await asUser(t, owner).mutation(api.channels.create, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      name: 'private-evidence', ownCompanyMemberIds: [],
    })
    await expect(asUser(t, owner).mutation(api.messages.send, {
      actingCompanyId: companyId, authorId: owner, body: 'Do not notify @evidence-outsider',
      groupId: privateChannelId, mentions: [outsider], projectId: created.projectId,
      projectMemberId: created.projectMemberId,
    })).rejects.toThrow('message_mention_unavailable')
    const messageId = await asUser(t, owner).mutation(api.messages.send, {
      actingCompanyId: companyId, authorId: owner, body: 'Private decision evidence',
      groupId: privateChannelId, mentions: [owner], mentionedProjectMemberIds: [created.projectMemberId],
      projectId: created.projectId, projectMemberId: created.projectMemberId,
    })
    const privateMessage = await t.run(async (ctx) => ctx.db.get(messageId))
    const memberProjectList = await asUser(t, member).query(api.projects.listAccessible, {})
    expect(memberProjectList.find((item) => item.project._id === created.projectId)?.lastActivityAt)
      .toBeLessThan(privateMessage!.createdAt)
    await asUser(t, owner).mutation(api.messages.edit, {
      actingCompanyId: companyId, actorId: owner, body: 'Updated private decision evidence',
      messageId, projectMemberId: created.projectMemberId,
    })
    expect(await t.run(async (ctx) => ctx.db.get(messageId))).toMatchObject({
      mentions: [], mentionedProjectMemberIds: [],
    })
    await asUser(t, owner).mutation(api.messages.edit, {
      actingCompanyId: companyId, actorId: owner, body: 'Updated evidence for @evidence-owner',
      messageId, projectMemberId: created.projectMemberId,
    })
    expect(await t.run(async (ctx) => ctx.db.get(messageId))).toMatchObject({
      mentions: [owner], mentionedProjectMemberIds: [created.projectMemberId],
    })
    const duplicateHandleUser = await seedUser(t, 'evidence-owner-duplicate')
    await t.run(async (ctx) => ctx.db.patch(duplicateHandleUser, {
      displayName: 'evidence-owner',
      updatedAt: Date.now(),
    }))
    await addCompanyMember(t, companyId, duplicateHandleUser)
    const duplicateHandleProjectMember = await asUser(t, owner).mutation(api.sharedProjects.addMember, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      role: 'member', userId: duplicateHandleUser,
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('groupMembers', {
        projectId: created.projectId,
        groupId: privateChannelId,
        userId: duplicateHandleUser,
        projectMemberId: duplicateHandleProjectMember,
        status: 'active',
        isSteward: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
    await asUser(t, owner).mutation(api.messages.edit, {
      actingCompanyId: companyId, actorId: owner, body: 'Still for @evidence-owner after clarification',
      messageId, projectMemberId: created.projectMemberId,
    })
    expect(await t.run(async (ctx) => ctx.db.get(messageId))).toMatchObject({
      mentions: [owner], mentionedProjectMemberIds: [created.projectMemberId],
    })
    await expect(asUser(t, member).mutation(api.messages.edit, {
      actingCompanyId: companyId, actorId: member, body: 'Cross-scope edit', messageId,
      projectMemberId: memberProjectId,
    })).rejects.toThrow('channel_unavailable')
    const privateTask = await asUser(t, owner).mutation(api.tasks.create, {
      actingCompanyId: companyId, groupId: privateChannelId, idempotencyKey: 'private-evidence-task',
      priority: 'none', projectId: created.projectId, projectMemberId: created.projectMemberId,
      references: [{ isPrimary: true, messageId, type: 'message' }], title: 'Private task',
    })
    await t.run(async (ctx) => ctx.db.patch(privateTask.taskId, { groupId: undefined, updatedAt: Date.now() }))
    const generalMessageId = await asUser(t, member).mutation(api.messages.send, {
      actingCompanyId: companyId, authorId: member, body: 'General decision evidence',
      groupId: created.groupId, projectId: created.projectId, projectMemberId: memberProjectId,
    })
    await asUser(t, member).mutation(api.tasks.create, {
      actingCompanyId: companyId, groupId: created.groupId, idempotencyKey: 'general-evidence-task',
      priority: 'none', projectId: created.projectId, projectMemberId: memberProjectId,
      references: [{ isPrimary: true, messageId: generalMessageId, type: 'message' }], title: 'General task',
    })
    const movedMessageId = await asUser(t, member).mutation(api.messages.send, {
      actingCompanyId: companyId, authorId: member, body: 'Task later moved to a private channel',
      groupId: created.groupId, projectId: created.projectId, projectMemberId: memberProjectId,
    })
    const movedTask = await asUser(t, member).mutation(api.tasks.create, {
      actingCompanyId: companyId, groupId: created.groupId, idempotencyKey: 'moved-evidence-task',
      priority: 'none', projectId: created.projectId, projectMemberId: memberProjectId,
      references: [{ isPrimary: true, messageId: movedMessageId, type: 'message' }], title: 'Moved task',
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(movedTask.taskId, { groupId: privateChannelId, updatedAt: Date.now() })
    })
    await t.run(async (ctx) => {
      const privateReference = await ctx.db.query('taskReferences')
        .withIndex('by_message', (q) => q.eq('messageId', messageId)).unique()
      if (privateReference) await ctx.db.patch(privateReference._id, { createdAt: Date.now() + 10_000 })
    })
    const ownerEvidence = await asUser(t, owner).query(api.evidence.listProjectPage, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: created.projectMemberId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(ownerEvidence.page).toHaveLength(3)
    expect(ownerEvidence.page).toContainEqual(expect.objectContaining({
      group: expect.objectContaining({ _id: privateChannelId }),
      reference: expect.objectContaining({ messageId }),
    }))
    const memberEvidence = await asUser(t, member).query(api.evidence.listProjectPage, {
      actingCompanyId: companyId, projectId: created.projectId, projectMemberId: memberProjectId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(memberEvidence.page).toHaveLength(1)
    expect(memberEvidence.page[0]?.reference.messageId).toBe(generalMessageId)
    expect(memberEvidence.page.some((item) => item.task._id === movedTask.taskId)).toBe(false)
  })

  it('does not let removed membership history hide active Projects', async () => {
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, 'project-history')
    const activeProjectId = await t.run(async (ctx) => {
      const now = Date.now()
      const historicalProjectId = await ctx.db.insert('projects', {
        name: 'Historical', accessProfile: 'legacy', createdBy: userId, createdAt: now, updatedAt: now,
      })
      for (let index = 0; index <= 200; index += 1) {
        await ctx.db.insert('projectMembers', {
          projectId: historicalProjectId, userId, role: 'member', status: 'removed',
          createdAt: now + index, updatedAt: now + index,
        })
      }
      const projectId = await ctx.db.insert('projects', {
        name: 'Current', accessProfile: 'legacy', createdBy: userId, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('projectMembers', {
        projectId, userId, role: 'staff', status: 'active', createdAt: now, updatedAt: now,
      })
      return projectId
    })

    const projects = await asUser(t, userId).query(api.projects.listAccessible, {})
    expect(projects.map((item) => item.project._id)).toEqual([activeProjectId])
  })
})

async function seedUser(t: TestBackend, subject: string) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      createdAt: now, displayName: subject, email: `${subject}@example.test`,
      googleSubject: subject, normalizedEmail: `${subject}@example.test`,
      twoFactorEnabled: false, updatedAt: now,
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

async function addCompanyMember(
  t: TestBackend,
  companyId: Id<'companies'>,
  userId: Id<'users'>,
  role: 'owner' | 'admin' | 'member' = 'member',
) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    const [company, user] = await Promise.all([ctx.db.get(companyId), ctx.db.get(userId)])
    return await ctx.db.insert('companyMembers', {
      companyId, companyDisplayNameSnapshot: company!.displayName, createdAt: now,
      role, status: 'active', updatedAt: now, userDisplayNameSnapshot: user!.displayName, userId,
    })
  })
}

async function membershipFor(
  t: TestBackend,
  companyId: Id<'companies'>,
  userId: Id<'users'>,
) {
  return await t.run(async (ctx) => {
    const memberships = await ctx.db.query('companyMembers').collect()
    return memberships.find((membership) =>
      membership.companyId === companyId && membership.userId === userId,
    ) ?? null
  })
}
