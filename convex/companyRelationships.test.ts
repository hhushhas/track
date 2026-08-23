import { convexTest } from 'convex-test'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
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
  process.env.TRACK_TASKS_ENABLED = 'true'
  process.env.TRACK_THREADS_ENABLED = 'true'
})

describe('Company model authorization and lifecycle', () => {
  it('enforces Company, member, and task scope', async () => {
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
    {
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
    }
    {
      const t = convexTest(schema, modules)
      const user = await seedUser(t, 'company-task-user')
      const companyId = await createCompany(t, user, 'Task Company', 'task-company')
      const otherCompanyId = await createCompany(t, user, 'Other Company', 'other-task-company')
      const projectId = await seedCompanyProject(t, user, companyId, 'Company Tasks')
      const { groupId, projectMemberId } = await t.run(async (ctx) => {
        const projectMember = (await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())[0]!
        const group = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())[0]!
        return { groupId: group._id, projectMemberId: projectMember._id }
      })
      const actor = asUser(t, user)
      const created = await actor.mutation(api.tasks.create, {
        projectId, groupId, actingCompanyId: companyId, projectMemberId,
        title: 'Company-scoped task', priority: 'high', idempotencyKey: 'company-task',
      })
      expect((await actor.query(api.tasks.list, {
        projectId, actingCompanyId: companyId, projectMemberId,
      })).map((item) => item.task._id)).toContain(created.taskId)
      await expect(actor.query(api.tasks.list, {
        projectId, actingCompanyId: otherCompanyId, projectMemberId,
      })).rejects.toThrow('project_unavailable')
    }
    {
      const t = convexTest(schema, modules)
      const owner = await seedUser(t, 'task-chain-owner')
      const recipient = await seedUser(t, 'task-chain-recipient')
      const companyId = await createCompany(t, owner, 'Task Chain Company', 'task-chain-company')
      await addCompanyMember(t, companyId, recipient)
      const projectId = await seedCompanyProject(t, owner, companyId, 'Task Chain Project')
      const ownerProjectMember = (await t.run(async (ctx) => ctx.db
        .query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).first()))!
      const recipientProjectMemberId = await asUser(t, owner).mutation(api.sharedProjects.addMember, {
        actingCompanyId: companyId, projectId, projectMemberId: ownerProjectMember._id,
        role: 'member', userId: recipient,
      })
      const recipientCompanyMember = (await t.run(async (ctx) => ctx.db
        .query('companyMembers')
        .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', recipient))
        .unique()))!
      await asUser(t, owner).mutation(api.companies.updateMember, {
        companyId, companyMemberId: recipientCompanyMember._id, status: 'suspended',
      })
      await expect(asUser(t, owner).mutation(api.tasks.create, {
        actingCompanyId: companyId,
        assigneeProjectMemberId: recipientProjectMemberId,
        idempotencyKey: 'inactive-company-task-assignee',
        priority: 'none', projectId, projectMemberId: ownerProjectMember._id,
        title: 'Do not assign inaccessible work',
      })).rejects.toThrow('task_assignee_invalid')
    }
  })

  it('enforces invitation and Project lifecycle transitions', async () => {
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
    {
      const t = convexTest(schema, modules)
      const owner = await seedUser(t, 'invited-owner')
      const companyId = await createCompany(t, owner, 'Invitation Safety', 'invitation-safety')
      const invitation = await asUser(t, owner).mutation(api.companies.inviteMember, {
        companyId, email: 'invited-owner@example.test', role: 'member',
      })
      await expect(asUser(t, owner).mutation(api.companies.decideInvitation, {
        decision: 'accept', invitationId: invitation.invitationId,
      })).rejects.toThrow('company_member_already_active')
      const membership = await t.run(async (ctx) => await ctx.db
        .query('companyMembers')
        .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', owner))
        .unique())
      expect(membership).toMatchObject({ role: 'owner', status: 'active' })
    }
    {
      const t = convexTest(schema, modules)
      const owner = await seedUser(t, 'closing-owner')
      const targetOwner = await seedUser(t, 'closing-target-owner')
      const companyId = await createCompany(t, owner, 'Closing Company', 'closing-company')
      const targetCompanyId = await createCompany(t, targetOwner, 'Closing Target', 'closing-target')
      const now = Date.now()
      const invitationIds = await t.run(async (ctx) => {
        const relationshipId = await ctx.db.insert('relationships', {
          name: 'Unaccepted Relationship', status: 'forming', createdBy: owner,
          createdByCompanyId: companyId, participantRevision: 0, revision: 1,
          createdAt: now, updatedAt: now,
        })
        const relationshipInvitationId = await ctx.db.insert('relationshipInvitations', {
          relationshipId, targetCompanyId, invitingCompanyId: companyId, invitedBy: owner,
          tokenHash: 'closing-relationship-invitation', status: 'pending', expiresAt: now + 60_000,
          createdAt: now, updatedAt: now,
        })
        const projectId = await ctx.db.insert('projects', {
          accessProfile: 'company', createdAt: now, createdBy: owner, name: 'Unaccepted Project',
          origin: 'shared', participantRevision: 0, revision: 1, status: 'proposed', updatedAt: now,
        })
        const projectInvitationId = await ctx.db.insert('projectCompanyInvitations', {
          projectId, targetCompanyId, invitingCompanyId: companyId, invitedBy: owner,
          tokenHash: 'closing-project-invitation', status: 'pending', expiresAt: now + 60_000,
          createdAt: now, updatedAt: now,
        })
        return { projectInvitationId, relationshipInvitationId }
      })
      await asUser(t, owner).mutation(api.companies.close, { companyId, retentionConfirmed: true })
      const closed = await t.run(async (ctx) => ({
        company: await ctx.db.get(companyId),
        projectInvitation: await ctx.db.get(invitationIds.projectInvitationId),
        relationshipInvitation: await ctx.db.get(invitationIds.relationshipInvitationId),
      }))
      expect(closed.company?.status).toBe('closed')
      expect(closed.projectInvitation?.status).toBe('revoked')
      expect(closed.relationshipInvitation?.status).toBe('revoked')
    }
    {
      const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
      const now = Date.now()
      const invitationId = await t.run(async (ctx) => {
        await ctx.db.patch(projectId, { status: 'archived', updatedAt: now })
        return await ctx.db.insert('projectCompanyInvitations', {
          projectId, targetCompanyId: bCompany, invitingCompanyId: aCompany, invitedBy: a,
          tokenHash: 'archived-project-invitation', status: 'pending', expiresAt: now + 60_000,
          createdAt: now, updatedAt: now,
        })
      })
      await expect(asUser(t, b).mutation(api.sharedProjects.decideInvitation, {
        actingCompanyId: bCompany, decision: 'accept', initialMembers: [{ role: 'manager', userId: b }], invitationId,
      })).rejects.toThrow('project_unavailable')
    }
  })

  it('enforces suspension and Channel steward invariants', async () => {
    const t = convexTest(schema, modules)
    const owner = await seedUser(t, 'owner')
    const companyId = await createCompany(t, owner, 'Recovery Company', 'recovery-company')
    const projectId = await seedCompanyProject(t, owner, companyId, 'Recovery Project')
    const actor = asUser(t, owner)

    await actor.mutation(api.companies.setSuspended, { companyId, suspended: true })
    await expect(actor.query(api.mobile.listProjects, { actingCompanyId: companyId, userId: owner })).rejects.toThrow('company_unavailable')
    await expect(actor.query(api.sharedProjects.listForActingCompany, { actingCompanyId: companyId })).rejects.toThrow('company_unavailable')

    process.env.TRACK_COMPANY_MODEL_ENABLED = 'false'
    await expect(actor.mutation(api.companies.setSuspended, { companyId, suspended: false }))
      .rejects.toThrow('company_model_disabled')
    process.env.TRACK_COMPANY_MODEL_ENABLED = 'true'
    await actor.mutation(api.companies.setSuspended, { companyId, suspended: false })
    const restored = await actor.query(api.mobile.listProjects, { actingCompanyId: companyId, userId: owner })
    expect(restored.map((item) => item.project._id)).toEqual([projectId])
    {
      const { a, aCompany, projectId, t } = await seedSharedProject()
      const replacement = await seedUser(t, 'company-a-project-manager')
      await addCompanyMember(t, aCompany, replacement)
      const memberships = await t.run(async (ctx) => await ctx.db
        .query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
      const original = memberships.find((membership) => membership.companyId === aCompany)!
      const replacementMembershipId = await asUser(t, a).mutation(api.sharedProjects.addMember, {
        actingCompanyId: aCompany, projectId, projectMemberId: original._id,
        role: 'manager', userId: replacement,
      })
      await asUser(t, a).mutation(api.sharedProjects.updateMember, {
        actingCompanyId: aCompany, projectId, projectMemberId: original._id,
        role: 'member', targetProjectMemberId: original._id,
      })
      const channelMemberships = await t.run(async (ctx) => await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) => q.eq('projectMemberId', original._id).eq('status', 'active')).collect())
      const replacementChannels = await t.run(async (ctx) => await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) => q.eq('projectMemberId', replacementMembershipId).eq('status', 'active')).collect())
      expect(channelMemberships.every((membership) => !membership.isSteward)).toBe(true)
      expect(replacementChannels.some((membership) => membership.isSteward)).toBe(true)
    }
    {
      const { a, aCompany, projectId, t } = await seedSharedProject()
      const projectMember = (await t.run(async (ctx) => ctx.db
        .query('projectMembers')
        .withIndex('by_project_company_status', (q) => q.eq('projectId', projectId).eq('companyId', aCompany).eq('status', 'active'))
        .first()))!
      const channelMembership = (await t.run(async (ctx) => ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) => q.eq('projectMemberId', projectMember._id).eq('status', 'active'))
        .first()))!
      await expect(asUser(t, a).mutation(api.channels.updateOwnCompanyMember, {
        actingCompanyId: aCompany, projectId, groupId: channelMembership.groupId,
        projectMemberId: projectMember._id, targetProjectMemberId: projectMember._id,
        active: true, steward: false,
      })).rejects.toThrow('last_channel_steward')
    }
  })

  it('keeps Project and Channel archive votes scoped and revision-safe', async () => {
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
    {
      const { a, aCompany, projectId, t } = await seedSharedProject()
      const membership = (await t.run(async (ctx) => await ctx.db
        .query('projectMembers')
        .withIndex('by_project_company_status', (q) => q.eq('projectId', projectId).eq('companyId', aCompany).eq('status', 'active'))
        .collect()))[0]
      const actor = asUser(t, a)
      const firstChannelId = await actor.mutation(api.channels.create, {
        actingCompanyId: aCompany, name: 'First private Channel', ownCompanyMemberIds: [membership._id],
        projectId, projectMemberId: membership._id,
      })
      const secondChannelId = await actor.mutation(api.channels.create, {
        actingCompanyId: aCompany, name: 'Second private Channel', ownCompanyMemberIds: [membership._id],
        projectId, projectMemberId: membership._id,
      })
      const requestId = await actor.mutation(api.channels.requestArchive, {
        actingCompanyId: aCompany, groupId: firstChannelId, idempotencyKey: 'channel-archive-1',
        operation: 'archive', projectId, projectMemberId: membership._id,
      })
      expect(await actor.mutation(api.channels.requestArchive, {
        actingCompanyId: aCompany, groupId: firstChannelId, idempotencyKey: 'channel-archive-1',
        operation: 'archive', projectId, projectMemberId: membership._id,
      })).toBe(requestId)
      await expect(actor.mutation(api.channels.approveArchive, {
        actingCompanyId: aCompany, groupId: secondChannelId, projectId,
        projectMemberId: membership._id, requestId,
      })).rejects.toThrow('channel_archive_request_scope_mismatch')
      await actor.mutation(api.channels.cancelArchive, {
        actingCompanyId: aCompany, groupId: firstChannelId, projectId,
        projectMemberId: membership._id, requestId,
      })
      const cancelled = await t.run(async (ctx) => ({
        channel: await ctx.db.get(firstChannelId), request: await ctx.db.get(requestId),
      }))
      expect(cancelled.channel?.status).toBe('active')
      expect(cancelled.request?.status).toBe('cancelled')
    }
    {
      const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
      const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers')
        .withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
      const aMembership = memberships.find((membership) => membership.companyId === aCompany)!
      const bMembership = memberships.find((membership) => membership.companyId === bCompany)!
      const actor = asUser(t, a)
      const groupId = await actor.mutation(api.channels.create, {
        actingCompanyId: aCompany, name: 'Changing participants', ownCompanyMemberIds: [aMembership._id],
        projectId, projectMemberId: aMembership._id,
      })
      const participationRequestId = await actor.mutation(api.channels.requestParticipation, {
        actingCompanyId: aCompany, groupId, idempotencyKey: 'invite-company-b', projectId,
        projectMemberId: aMembership._id, selectedProjectMemberIds: [bMembership._id],
        targetProjectCompanyId: bMembership.projectCompanyId!,
      })
      const archiveRequestId = await actor.mutation(api.channels.requestArchive, {
        actingCompanyId: aCompany, groupId, idempotencyKey: 'archive-before-company-b-joins',
        operation: 'archive', projectId, projectMemberId: aMembership._id,
      })
      await asUser(t, b).mutation(api.channels.decideParticipation, {
        actingCompanyId: bCompany, decision: 'accept', groupId, projectId,
        projectMemberId: bMembership._id, requestId: participationRequestId,
        selectedProjectMemberIds: [bMembership._id],
      })
      const state = await t.run(async (ctx) => ({
        channel: await ctx.db.get(groupId), request: await ctx.db.get(archiveRequestId),
      }))
      expect(state.channel).toMatchObject({ revision: 2, status: 'active' })
      expect(state.request?.status).toBe('stale')
    }
  })

  it('validates legacy-to-Company migration mappings and drift', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const owner = await seedUser(t, 'upgrade-owner')
    const member = await seedUser(t, 'upgrade-member')
    const companyId = await createCompany(t, owner, 'Upgrade Company', 'upgrade-company')
    await addCompanyMember(t, companyId, member)
    const { groupId, projectId } = await seedLegacyProject(t, owner, member)
    const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
    const ownerMembership = memberships.find((membership) => membership.userId === owner)!
    const before = await t.run(async (ctx) => (await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', groupId)).collect()).map((row) => row.userId).sort())
    const actor = asUser(t, owner)
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'upgrade-thread',
      name: 'Migration continuity',
      projectId,
    })
    const threadMessageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Preserve this focused migration evidence.',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'upgrade-thread-message',
      projectId,
    })
    const task = await actor.mutation(api.tasks.create, {
      projectId,
      groupId,
      title: 'Preserve migrated thread work',
      priority: 'none',
      references: [{ type: 'message', messageId: threadMessageId, isPrimary: true }],
      idempotencyKey: 'upgrade-thread-task',
    })
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
    expect(await actor.query(api.channelThreads.get, {
      threadId,
      userId: owner,
      actingCompanyId: companyId,
      projectMemberId: ownerMembership._id,
    })).toMatchObject({ thread: { _id: threadId } })
    expect(await actor.query(api.tasks.getByKey, {
      projectId,
      publicKey: task.publicKey,
      actingCompanyId: companyId,
      projectMemberId: ownerMembership._id,
    })).toMatchObject({
      task: { _id: task.taskId },
      references: [{ messageId: threadMessageId, channelThreadId: threadId }],
    })
    {
      const t = convexTest(schema, modules)
      const owner = await seedUser(t, 'drift-owner')
      const member = await seedUser(t, 'drift-member')
      const companyId = await createCompany(t, owner, 'Drift Company', 'drift-company')
      await addCompanyMember(t, companyId, member)
      const { groupId, projectId } = await seedLegacyProject(t, owner, member)
      const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers')
        .withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
      const actor = asUser(t, owner)
      const upgradeId = await actor.mutation(api.companyMigration.initiate, {
        idempotencyKey: 'upgrade-drift', initiatingCompanyId: companyId,
        mappings: memberships.map((membership) => ({
          companyId,
          neutralRole: membership.userId === owner ? 'manager' as const : 'member' as const,
          projectMemberId: membership._id,
        })), projectId,
      })
      await t.run(async (ctx) => {
        const channelMember = (await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', groupId)).collect())[0]
        await ctx.db.patch(channelMember._id, { isSteward: true, updatedAt: Date.now() + 1 })
      })
      await expect(actor.mutation(api.companyMigration.activate, { upgradeId }))
        .rejects.toThrow('upgrade_source_changed')
    }
    {
      const t = convexTest(schema, modules)
      const owner = await seedUser(t, 'company-drift-owner')
      const member = await seedUser(t, 'company-drift-member')
      const companyId = await createCompany(t, owner, 'Company Drift', 'company-drift')
      await addCompanyMember(t, companyId, member)
      const { projectId } = await seedLegacyProject(t, owner, member)
      const memberships = await t.run(async (ctx) => await ctx.db.query('projectMembers')
        .withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
      const actor = asUser(t, owner)
      const upgradeId = await actor.mutation(api.companyMigration.initiate, {
        idempotencyKey: 'upgrade-company-drift', initiatingCompanyId: companyId,
        mappings: memberships.map((membership) => ({
          companyId,
          neutralRole: membership.userId === owner ? 'manager' as const : 'member' as const,
          projectMemberId: membership._id,
        })), projectId,
      })
      await t.run(async (ctx) => {
        const companyMembership = await ctx.db.query('companyMembers')
          .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', member)).unique()
        const now = Date.now()
        await ctx.db.patch(companyMembership!._id, { status: 'removed', endedAt: now, updatedAt: now })
      })
      await expect(actor.mutation(api.companyMigration.activate, { upgradeId }))
        .rejects.toThrow('mapped_company_member_unavailable')
    }
  })

  it('requires forwarding confirmation when a same-Company destination adds people', async () => {
    const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
    const extraRecipient = await seedUser(t, 'forward-extra-recipient')
    await addCompanyMember(t, bCompany, extraRecipient)
    const initialMembers = await t.run(async (ctx) => ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect())
    const aMember = initialMembers.find((member) => member.companyId === aCompany)!
    const bMember = initialMembers.find((member) => member.companyId === bCompany)!
    const extraMemberId = await asUser(t, b).mutation(api.sharedProjects.addMember, {
      actingCompanyId: bCompany,
      projectId,
      projectMemberId: bMember._id,
      role: 'member',
      userId: extraRecipient,
    })
    const { sourceGroupId, targetGroupId } = await t.run(async (ctx) => {
      const now = Date.now()
      const sourceGroupId = await ctx.db.insert('groups', {
        createdAt: now, createdBy: a, kind: 'custom', name: 'Source audience',
        projectId, revision: 1, status: 'active', updatedAt: now,
      })
      const targetGroupId = await ctx.db.insert('groups', {
        createdAt: now, createdBy: a, kind: 'custom', name: 'Expanded audience',
        projectId, revision: 1, status: 'active', updatedAt: now,
      })
      for (const [groupId, members] of [
        [sourceGroupId, [aMember, bMember]],
        [targetGroupId, [aMember, bMember, { ...bMember, _id: extraMemberId, userId: extraRecipient }]],
      ] as const) {
        for (const member of members) await ctx.db.insert('groupMembers', {
          createdAt: now,
          groupId,
          isSteward: member._id === aMember._id,
          projectId,
          projectMemberId: member._id,
          status: 'active',
          updatedAt: now,
          userId: member.userId,
        })
      }
      return { sourceGroupId, targetGroupId }
    })
    const sourceMessageId = await asUser(t, a).mutation(api.messages.send, {
      actingCompanyId: aCompany,
      authorId: a,
      body: 'Share only after confirming the additional person.',
      groupId: sourceGroupId,
      idempotencyKey: 'member-expansion-source',
      projectId,
      projectMemberId: aMember._id,
    })
    const forwardArgs = {
      actingCompanyId: aCompany,
      actorId: a,
      idempotencyKey: 'member-expansion-forward',
      projectId,
      projectMemberId: aMember._id,
      sourceMessageId,
      targetGroupId,
    }
    await expect(asUser(t, a).mutation(api.messages.forwardMessage, forwardArgs))
      .rejects.toThrow('audience_expansion_confirmation_required')
    await expect(asUser(t, a).mutation(api.messages.forwardMessage, {
      ...forwardArgs,
      audienceExpansionConfirmed: true,
    })).resolves.toBeDefined()
  })

  it('requires a verified exit snapshot, creates exact archives, and terminally archives after the last exit', async () => {
    const { a, aCompany, b, bCompany, projectId, t } = await seedSharedProject()
    const initialMemberships = await t.run(async (ctx) => await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect())
    const aInitialMembership = initialMemberships.find((membership) => membership.companyId === aCompany)!
    const groupId = await t.run(async (ctx) => (await ctx.db
      .query('groups')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first())!._id)
    const exitThreadId = await asUser(t, a).mutation(api.channelThreads.create, {
      creatorId: a,
      groupId,
      idempotencyKey: 'exit-thread',
      name: 'Exit snapshot thread',
      projectId,
      actingCompanyId: aCompany,
      projectMemberId: aInitialMembership._id,
    })
    const exitMessageId = await asUser(t, a).mutation(api.messages.send, {
      authorId: a,
      body: 'Snapshot this focused task source.',
      channelThreadId: exitThreadId,
      groupId,
      idempotencyKey: 'exit-thread-message',
      projectId,
      actingCompanyId: aCompany,
      projectMemberId: aInitialMembership._id,
    })
    const exitTask = await asUser(t, a).mutation(api.tasks.create, {
      projectId,
      groupId,
      title: 'Archive focused work',
      priority: 'none',
      references: [{ type: 'message', messageId: exitMessageId, isPrimary: true }],
      idempotencyKey: 'exit-thread-task',
      actingCompanyId: aCompany,
      projectMemberId: aInitialMembership._id,
    })
    const exitLabelId = await asUser(t, a).mutation(api.taskLabels.create, {
      projectId,
      name: 'Exit label',
      colorToken: 'blue',
      actingCompanyId: aCompany,
      projectMemberId: aInitialMembership._id,
    })
    const archiveRequestId = await asUser(t, a).mutation(api.projectArchives.request, {
      actingCompanyId: aCompany,
      idempotencyKey: 'archive-before-exit',
      operation: 'archive',
      projectId,
      projectMemberId: aInitialMembership._id,
    })
    const prepared = await asUser(t, a).mutation(api.projectExit.prepare, { actingCompanyId: aCompany, projectId })
    expect(await asUser(t, a).mutation(api.projectExit.prepare, { actingCompanyId: aCompany, projectId })).toBe(prepared)
    expect(await asUser(t, a).query(api.projectExit.getStatus, {
      actingCompanyId: aCompany,
      projectId,
      projectMemberId: aInitialMembership._id,
    })).toMatchObject({ status: 'exit_pending' })
    expect((await t.run(async (ctx) => await ctx.db.get(archiveRequestId)))?.status).toBe('stale')
    await expect(asUser(t, a).mutation(api.projectExit.finalize, { actingCompanyId: aCompany, projectId })).rejects.toThrow('exit_snapshot_not_verified')
    const postCutoffMember = await seedUser(t, 'post-cutoff-project-member')
    await addCompanyMember(t, bCompany, postCutoffMember)
    const bInitialMembership = initialMemberships.find((membership) => membership.companyId === bCompany)!
    await t.run(async (ctx) => {
      const now = Date.now()
      const [company, user] = await Promise.all([
        ctx.db.get(bCompany),
        ctx.db.get(postCutoffMember),
      ])
      await ctx.db.patch(projectId, { name: 'Live Project after exit', updatedAt: now })
      await ctx.db.patch(groupId, { name: 'Live Channel after exit', updatedAt: now })
      await ctx.db.patch(a, { displayName: 'Live author after exit', updatedAt: now })
      await ctx.db.patch(aInitialMembership._id, {
        role: 'member',
        userDisplayNameSnapshot: 'Live author after exit',
        updatedAt: now,
      })
      await ctx.db.patch(exitTask.taskId, {
        title: 'Live task after exit',
        searchText: 'Live task after exit ',
        revision: 2,
        updatedAt: now,
      })
      await ctx.db.patch(exitLabelId, { name: 'Live label after exit', updatedAt: now })
      await ctx.db.insert('projectMembers', {
        projectId,
        projectCompanyId: bInitialMembership.projectCompanyId,
        companyId: bCompany,
        userId: postCutoffMember,
        role: 'member',
        status: 'active',
        term: 1,
        invitedBy: b,
        userDisplayNameSnapshot: user!.displayName,
        companyDisplayNameSnapshot: company!.displayName,
        createdAt: now,
        updatedAt: now,
      })
    })
    await asUser(t, b).mutation(api.channelThreads.rename, {
      actingCompanyId: bCompany,
      expectedRevision: 1,
      name: 'Live thread after exit',
      projectMemberId: bInitialMembership._id,
      threadId: exitThreadId,
      userId: b,
    })
    await verifyPendingSnapshot(t, projectId, aCompany)
    await asUser(t, a).mutation(api.projectExit.finalize, { actingCompanyId: aCompany, projectId })

    const firstExit = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const aMember = (await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()).find((member) => member.companyId === aCompany)
      const entitlement = aMember ? await ctx.db.query('projectArchiveEntitlements').withIndex('by_member', (q) => q.eq('projectMemberId', aMember._id)).unique() : null
      const taskSnapshots = entitlement
        ? await ctx.db.query('taskArchiveSnapshots')
            .withIndex('by_entitlement_table', (q) =>
              q.eq('entitlementId', entitlement._id).eq('sourceTable', 'tasks'),
            )
            .collect()
        : []
      return { aMember, entitlement, project, taskSnapshots }
    })
    expect(firstExit.project?.status).toBe('active')
    expect(firstExit.aMember?.status).toBe('archived')
    expect(firstExit.entitlement?.channelIds).toHaveLength(1)
    expect(firstExit.entitlement?.memberSnapshots).toHaveLength(2)
    expect(firstExit.entitlement?.threadSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: exitThreadId, replyCount: 1 }),
    ]))
    expect(firstExit.taskSnapshots).toHaveLength(1)
    const archivedIdentity = {
      actingCompanyId: aCompany,
      projectMemberId: firstExit.aMember!._id,
    }
    expect(await asUser(t, a).query(api.channelThreads.listMessages, {
      threadId: exitThreadId,
      userId: a,
      ...archivedIdentity,
    })).toEqual([
      expect.objectContaining({
        author: expect.objectContaining({ displayName: 'company-a-owner' }),
        authorRole: 'manager',
      }),
    ])
    expect((await asUser(t, a).query(api.search.project, {
      filter: 'groups', projectId, query: 'General', userId: a, ...archivedIdentity,
    })).groups).toEqual([expect.objectContaining({ title: 'General' })])
    expect((await asUser(t, a).query(api.search.project, {
      filter: 'groups', projectId, query: 'Live Channel after exit', userId: a, ...archivedIdentity,
    })).groups).toEqual([])
    expect((await asUser(t, a).query(api.search.project, {
      filter: 'threads', projectId, query: 'Exit snapshot thread', userId: a, ...archivedIdentity,
    })).threads).toEqual([expect.objectContaining({ title: 'Exit snapshot thread' })])
    expect((await asUser(t, a).query(api.search.project, {
      filter: 'threads', projectId, query: 'Live thread after exit', userId: a, ...archivedIdentity,
    })).threads).toEqual([])
    expect(await asUser(t, a).query(api.taskSearch.search, {
      projectId,
      term: 'Archive focused work',
      ...archivedIdentity,
    })).toEqual([
      expect.objectContaining({ task: expect.objectContaining({ title: 'Archive focused work' }) }),
    ])
    expect(await asUser(t, a).query(api.taskSearch.search, {
      projectId,
      term: 'Live task after exit',
      ...archivedIdentity,
    })).toEqual([])
    expect(await asUser(t, a).query(api.taskLabels.list, {
      projectId,
      ...archivedIdentity,
    })).toEqual([expect.objectContaining({ name: 'Exit label' })])
    expect((await asUser(t, a).query(api.sharedProjects.listForActingCompany, {
      actingCompanyId: aCompany,
    }))[0]?.project).toMatchObject({ name: 'Shared Project' })
    expect((await asUser(t, a).query(api.mobile.listProjects, {
      actingCompanyId: aCompany,
      userId: a,
    }))[0]?.project).toMatchObject({ name: 'Shared Project' })
    expect(await asUser(t, a).query(api.mobile.resolveNavigation, {
      actingCompanyId: aCompany,
      groupId,
      projectId,
      projectMemberId: firstExit.aMember!._id,
      userId: a,
    })).toEqual({ available: true, archived: true, readStateImmutable: true })

    const replacementOwner = await seedUser(t, 'company-a-replacement-owner')
    await addCompanyMember(t, aCompany, replacementOwner, 'owner')
    const formerOwnerMembership = await t.run(async (ctx) => await ctx.db
      .query('companyMembers')
      .withIndex('by_company_user', (q) => q.eq('companyId', aCompany).eq('userId', a))
      .unique())
    await asUser(t, replacementOwner).mutation(api.companies.updateMember, {
      companyId: aCompany,
      companyMemberId: formerOwnerMembership!._id,
      status: 'removed',
    })
    expect((await t.run(async (ctx) => await ctx.db.get(firstExit.entitlement!._id)))?.retentionStatus).toBe('revoked')
    await asUser(t, replacementOwner).mutation(api.companies.updateMember, {
      companyId: aCompany,
      companyMemberId: formerOwnerMembership!._id,
      status: 'active',
    })
    await asUser(t, replacementOwner).mutation(api.companies.updateMember, {
      companyId: aCompany,
      companyMemberId: formerOwnerMembership!._id,
      role: 'member',
    })
    expect(await asUser(t, a).query(api.mobile.listProjects, {
      actingCompanyId: aCompany,
      userId: a,
    })).toEqual([])

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

async function addCompanyMember(
  t: TestBackend,
  companyId: Id<'companies'>,
  userId: Id<'users'>,
  role: 'owner' | 'admin' | 'member' = 'member',
) {
  const now = Date.now()
  await t.run(async (ctx) => {
    const [company, user] = await Promise.all([ctx.db.get(companyId), ctx.db.get(userId)])
    await ctx.db.insert('companyMembers', {
      companyId,
      companyDisplayNameSnapshot: company!.displayName,
      createdAt: now,
      role,
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
  registerRateLimiter(t)
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
