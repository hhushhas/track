import { resolveProjectAccessProfile } from '@track/shared/feature-flags'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireAuthenticatedActor } from './lib/actorContext'
import {
  requireActiveRelationshipParticipant,
  requireCompanyAdmin,
  requireCompanyModelEnabled,
} from './lib/companyPolicy'
import { requireProjectOwner } from './lib/permissions'

const mappingInput = v.object({
  projectMemberId: v.id('projectMembers'),
  companyId: v.id('companies'),
  neutralRole: v.union(v.literal('manager'), v.literal('member')),
})

function sourceFingerprint(rows: Array<{ id: string } & Record<string, unknown>>) {
  return JSON.stringify([...rows].sort((left, right) => left.id.localeCompare(right.id)))
}

function memberFingerprint(members: Array<{
  _id: unknown
  companyId?: unknown
  projectCompanyId?: unknown
  role?: unknown
  status?: unknown
  updatedAt?: unknown
  userId: unknown
}>) {
  return sourceFingerprint(members.map((member) => ({
    id: String(member._id),
    companyId: member.companyId ? String(member.companyId) : null,
    projectCompanyId: member.projectCompanyId ? String(member.projectCompanyId) : null,
    role: member.role,
    status: member.status,
    updatedAt: member.updatedAt,
    userId: String(member.userId),
  })))
}

function groupFingerprint(groups: Array<{
  _id: unknown
  kind?: unknown
  name: unknown
  status?: unknown
  updatedAt?: unknown
}>) {
  return sourceFingerprint(groups.map((group) => ({
    id: String(group._id),
    kind: group.kind,
    name: group.name,
    status: group.status,
    updatedAt: group.updatedAt,
  })))
}

function groupMembershipFingerprint(memberships: Array<{
  _id: unknown
  groupId: unknown
  isSteward?: unknown
  projectMemberId?: unknown
  status?: unknown
  updatedAt?: unknown
  userId: unknown
}>) {
  return sourceFingerprint(memberships.map((membership) => ({
    id: String(membership._id),
    groupId: String(membership.groupId),
    isSteward: membership.isSteward,
    projectMemberId: membership.projectMemberId ? String(membership.projectMemberId) : null,
    status: membership.status,
    updatedAt: membership.updatedAt,
    userId: String(membership.userId),
  })))
}

export const listPendingForCompany = query({
  args: { actingCompanyId: v.id('companies') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const confirmations = await ctx.db
      .query('legacyProjectUpgradeCompanies')
      .withIndex('by_company_status', (q) => q.eq('companyId', args.actingCompanyId).eq('status', 'pending'))
      .collect()
    return await Promise.all(confirmations.map(async (confirmation) => {
      const upgrade = await ctx.db.get(confirmation.upgradeId)
      const project = upgrade ? await ctx.db.get(upgrade.projectId) : null
      const mappings = upgrade
        ? await ctx.db.query('legacyProjectUpgradeMappings').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect()
        : []
      const ownMappings = mappings.filter((mapping) => mapping.companyId === args.actingCompanyId)
      return {
        confirmation,
        upgrade,
        project: project ? { _id: project._id, name: project.name } : null,
        ownMappings: await Promise.all(ownMappings.map(async (mapping) => {
          const member = await ctx.db.get(mapping.legacyProjectMemberId)
          const user = member ? await ctx.db.get(member.userId) : null
          return {
            mapping,
            user: user ? { _id: user._id, displayName: user.displayName } : null,
          }
        })),
      }
    }))
  },
})

export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireProjectOwner(ctx, args.projectId, actor.userId)
    const upgrades = await ctx.db
      .query('legacyProjectUpgrades')
      .withIndex('by_project_status', (q) => q.eq('projectId', args.projectId))
      .collect()
    const upgrade = upgrades.find((item) => item.status !== 'cancelled')
    if (!upgrade) return null
    const [mappings, companies] = await Promise.all([
      ctx.db.query('legacyProjectUpgradeMappings').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect(),
      ctx.db.query('legacyProjectUpgradeCompanies').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect(),
    ])
    return { upgrade, mappings, companies }
  },
})

export const initiate = mutation({
  args: {
    projectId: v.id('projects'),
    initiatingCompanyId: v.id('companies'),
    relationshipId: v.optional(v.id('relationships')),
    mappings: v.array(mappingInput),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireProjectOwner(ctx, args.projectId, actor.userId)
    await requireCompanyAdmin(ctx, actor, args.initiatingCompanyId)
    const project = await ctx.db.get(args.projectId)
    if (!project || resolveProjectAccessProfile(project.accessProfile) !== 'legacy') throw new Error('legacy_project_required')
    const existing = await ctx.db
      .query('legacyProjectUpgrades')
      .withIndex('by_project_idempotency', (q) => q.eq('projectId', project._id).eq('idempotencyKey', args.idempotencyKey))
      .unique()
    if (existing) return existing._id
    const members = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect()
    const groups = await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect()
    const groupMemberships = (await Promise.all(groups.map((group) =>
      ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', group._id)).collect(),
    ))).flat()
    const mappingIds = new Set(args.mappings.map((mapping) => mapping.projectMemberId))
    if (mappingIds.size !== members.length || members.some((member) => !mappingIds.has(member._id))) {
      throw new Error('every_project_member_must_be_mapped')
    }
    const companyIds = Array.from(new Set(args.mappings.map((mapping) => mapping.companyId)))
    if (!companyIds.includes(args.initiatingCompanyId)) throw new Error('initiating_company_mapping_required')
    if (companyIds.length > 1 && !args.relationshipId) throw new Error('relationship_required')
    for (const companyId of companyIds) {
      const company = await ctx.db.get(companyId)
      if (!company || company.status !== 'active') throw new Error('mapped_company_unavailable')
      if (args.relationshipId) await requireActiveRelationshipParticipant(ctx, args.relationshipId, companyId)
    }
    for (const mapping of args.mappings) {
      const projectMember = members.find((member) => member._id === mapping.projectMemberId)
      if (!projectMember) throw new Error('project_member_mapping_invalid')
      const companyMember = await ctx.db
        .query('companyMembers')
        .withIndex('by_company_user', (q) => q.eq('companyId', mapping.companyId).eq('userId', projectMember.userId))
        .unique()
      if (!companyMember || companyMember.status !== 'active') throw new Error('mapped_company_member_unavailable')
    }
    const now = Date.now()
    const upgradeId = await ctx.db.insert('legacyProjectUpgrades', {
      projectId: project._id,
      relationshipId: args.relationshipId,
      initiatedBy: actor.userId,
      initiatingCompanyId: args.initiatingCompanyId,
      status: companyIds.length === 1 ? 'ready' : 'awaiting_confirmation',
      sourceRevision: project.revision ?? 0,
      sourceUpdatedAt: project.updatedAt,
      sourceMemberIds: members.map((member) => member._id),
      sourceGroupIds: groups.map((group) => group._id),
      sourceGroupMembershipIds: groupMemberships.map((membership) => membership._id),
      sourceMemberFingerprint: memberFingerprint(members),
      sourceGroupFingerprint: groupFingerprint(groups),
      sourceGroupMembershipFingerprint: groupMembershipFingerprint(groupMemberships),
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    for (const mapping of args.mappings) {
      await ctx.db.insert('legacyProjectUpgradeMappings', {
        upgradeId,
        legacyProjectMemberId: mapping.projectMemberId,
        companyId: mapping.companyId,
        neutralRole: mapping.neutralRole,
        confirmedByCompany: mapping.companyId === args.initiatingCompanyId,
        createdAt: now,
        updatedAt: now,
      })
    }
    for (const companyId of companyIds) {
      await ctx.db.insert('legacyProjectUpgradeCompanies', {
        upgradeId,
        companyId,
        status: companyId === args.initiatingCompanyId ? 'confirmed' : 'pending',
        confirmedBy: companyId === args.initiatingCompanyId ? actor.userId : undefined,
        confirmedAt: companyId === args.initiatingCompanyId ? now : undefined,
        createdAt: now,
        updatedAt: now,
      })
    }
    return upgradeId
  },
})

export const confirmCompany = mutation({
  args: {
    upgradeId: v.id('legacyProjectUpgrades'),
    actingCompanyId: v.id('companies'),
    managerProjectMemberIds: v.array(v.id('projectMembers')),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const upgrade = await ctx.db.get(args.upgradeId)
    if (!upgrade || (upgrade.status !== 'awaiting_confirmation' && upgrade.status !== 'ready')) {
      throw new Error('upgrade_unavailable')
    }
    const companyConfirmation = await ctx.db
      .query('legacyProjectUpgradeCompanies')
      .withIndex('by_upgrade_company', (q) => q.eq('upgradeId', upgrade._id).eq('companyId', args.actingCompanyId))
      .unique()
    if (!companyConfirmation) throw new Error('upgrade_company_unavailable')
    const mappings = await ctx.db.query('legacyProjectUpgradeMappings').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect()
    const ownMappings = mappings.filter((mapping) => mapping.companyId === args.actingCompanyId)
    const managerIds = new Set(args.managerProjectMemberIds)
    if (managerIds.size === 0 || Array.from(managerIds).some((id) => !ownMappings.some((mapping) => mapping.legacyProjectMemberId === id))) {
      throw new Error('confirmed_manager_required')
    }
    const now = Date.now()
    await Promise.all(ownMappings.map((mapping) => ctx.db.patch(mapping._id, {
      neutralRole: managerIds.has(mapping.legacyProjectMemberId) ? 'manager' : 'member',
      confirmedByCompany: true,
      updatedAt: now,
    })))
    await ctx.db.patch(companyConfirmation._id, {
      status: 'confirmed',
      confirmedBy: actor.userId,
      confirmedAt: now,
      updatedAt: now,
    })
    const confirmations = await ctx.db.query('legacyProjectUpgradeCompanies').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect()
    if (confirmations.every((item) => item._id === companyConfirmation._id || item.status === 'confirmed')) {
      await ctx.db.patch(upgrade._id, { status: 'ready', updatedAt: now })
    }
    return upgrade._id
  },
})

export const cancel = mutation({
  args: { upgradeId: v.id('legacyProjectUpgrades') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const upgrade = await ctx.db.get(args.upgradeId)
    if (!upgrade || upgrade.status === 'activated') throw new Error('upgrade_unavailable')
    await requireProjectOwner(ctx, upgrade.projectId, actor.userId)
    await ctx.db.patch(upgrade._id, { status: 'cancelled', updatedAt: Date.now() })
    return upgrade._id
  },
})

export const activate = mutation({
  args: { upgradeId: v.id('legacyProjectUpgrades') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const upgrade = await ctx.db.get(args.upgradeId)
    if (!upgrade) throw new Error('upgrade_unavailable')
    if (upgrade.status === 'activated') return upgrade.projectId
    if (upgrade.status !== 'ready') throw new Error('upgrade_not_ready')
    await requireProjectOwner(ctx, upgrade.projectId, actor.userId)
    const project = await ctx.db.get(upgrade.projectId)
    if (
      !project ||
      resolveProjectAccessProfile(project.accessProfile) !== 'legacy' ||
      (project.revision ?? 0) !== upgrade.sourceRevision ||
      project.updatedAt !== upgrade.sourceUpdatedAt
    ) {
      throw new Error('upgrade_source_changed')
    }
    const [mappings, confirmations, currentMembers, currentGroups] = await Promise.all([
      ctx.db.query('legacyProjectUpgradeMappings').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect(),
      ctx.db.query('legacyProjectUpgradeCompanies').withIndex('by_upgrade', (q) => q.eq('upgradeId', upgrade._id)).collect(),
      ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect(),
      ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect(),
    ])
    const currentGroupMemberships = (await Promise.all(currentGroups.map((group) =>
      ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', group._id)).collect(),
    ))).flat()
    const sameIds = (left: Array<unknown>, right: Array<unknown>) =>
      left.map(String).sort().join('|') === right.map(String).sort().join('|')
    if (
      !sameIds(currentMembers.map((member) => member._id), upgrade.sourceMemberIds) ||
      !sameIds(currentGroups.map((group) => group._id), upgrade.sourceGroupIds) ||
      !sameIds(currentGroupMemberships.map((membership) => membership._id), upgrade.sourceGroupMembershipIds) ||
      memberFingerprint(currentMembers) !== upgrade.sourceMemberFingerprint ||
      groupFingerprint(currentGroups) !== upgrade.sourceGroupFingerprint ||
      groupMembershipFingerprint(currentGroupMemberships) !== upgrade.sourceGroupMembershipFingerprint
    ) throw new Error('upgrade_source_changed')
    if (!confirmations.every((confirmation) => confirmation.status === 'confirmed')) throw new Error('upgrade_not_confirmed')
    const confirmedCompanyIds = new Set(confirmations.map((confirmation) => String(confirmation.companyId)))
    for (const confirmation of confirmations) {
      const company = await ctx.db.get(confirmation.companyId)
      if (!company || company.status !== 'active') throw new Error('mapped_company_unavailable')
      if (upgrade.relationshipId) {
        await requireActiveRelationshipParticipant(ctx, upgrade.relationshipId, company._id)
      }
    }
    for (const mapping of mappings) {
      if (!confirmedCompanyIds.has(String(mapping.companyId))) throw new Error('upgrade_mapping_stale')
      const member = currentMembers.find((candidate) => candidate._id === mapping.legacyProjectMemberId)
      if (!member) throw new Error('upgrade_mapping_stale')
      const companyMembership = await ctx.db
        .query('companyMembers')
        .withIndex('by_company_user', (q) =>
          q.eq('companyId', mapping.companyId).eq('userId', member.userId),
        )
        .unique()
      if (!companyMembership || companyMembership.status !== 'active') {
        throw new Error('mapped_company_member_unavailable')
      }
    }
    const mappingByUser = new Map(currentMembers.map((member) => [
      String(member.userId),
      mappings.find((mapping) => mapping.legacyProjectMemberId === member._id),
    ]))
    for (const group of currentGroups) {
      const groupMappings = currentGroupMemberships
        .filter((membership) => membership.groupId === group._id)
        .map((membership) => mappingByUser.get(String(membership.userId)))
        .filter((mapping) => mapping !== undefined)
      for (const companyId of new Set(groupMappings.map((mapping) => mapping.companyId))) {
        if (!groupMappings.some((mapping) =>
          mapping.companyId === companyId && mapping.neutralRole === 'manager',
        )) throw new Error('channel_company_steward_required')
      }
    }
    const now = Date.now()
    const projectCompanyByCompany = new Map()
    for (const confirmation of confirmations) {
      if (!mappings.some((mapping) => mapping.companyId === confirmation.companyId && mapping.neutralRole === 'manager')) {
        throw new Error('company_manager_required')
      }
      const projectCompanyId = await ctx.db.insert('projectCompanies', {
        projectId: project._id,
        companyId: confirmation.companyId,
        term: 1,
        status: 'active',
        acceptedBy: confirmation.confirmedBy ?? actor.userId,
        acceptedAt: confirmation.confirmedAt ?? now,
        createdAt: now,
        updatedAt: now,
      })
      projectCompanyByCompany.set(String(confirmation.companyId), projectCompanyId)
    }
    for (const mapping of mappings) {
      const member = await ctx.db.get(mapping.legacyProjectMemberId)
      const company = await ctx.db.get(mapping.companyId)
      const user = member ? await ctx.db.get(member.userId) : null
      if (!member || !company || !user) throw new Error('upgrade_mapping_stale')
      await ctx.db.patch(member._id, {
        companyId: company._id,
        projectCompanyId: projectCompanyByCompany.get(String(company._id)),
        role: mapping.neutralRole,
        status: 'active',
        term: 1,
        userDisplayNameSnapshot: user.displayName,
        companyDisplayNameSnapshot: company.displayName,
        updatedAt: now,
      })
      const channelMemberships = await ctx.db.query('groupMembers').withIndex('by_user', (q) => q.eq('userId', member.userId)).collect()
      await Promise.all(channelMemberships.filter((membership) => membership.projectId === project._id).map((membership) =>
        ctx.db.patch(membership._id, {
          projectMemberId: member._id,
          status: 'active',
          isSteward: mapping.neutralRole === 'manager',
          updatedAt: now,
        }),
      ))
    }
    await ctx.db.patch(project._id, {
      accessProfile: 'company',
      relationshipId: upgrade.relationshipId,
      proposingCompanyId: upgrade.initiatingCompanyId,
      origin: confirmations.length === 1 ? 'single_company' : 'shared',
      status: 'active',
      participantRevision: confirmations.length,
      revision: (project.revision ?? 0) + 1,
      updatedAt: now,
    })
    await ctx.db.patch(upgrade._id, { status: 'activated', activatedAt: now, updatedAt: now })
    await appendAuditEvent(ctx, {
      companyId: upgrade.initiatingCompanyId,
      relationshipId: upgrade.relationshipId,
      projectId: project._id,
      actorId: actor.userId,
      actingCompanyId: upgrade.initiatingCompanyId,
      entityType: 'legacyProjectUpgrade',
      entityId: upgrade._id,
      action: 'legacy_project_upgrade.activated',
      after: { companyCount: confirmations.length, memberCount: mappings.length },
    })
    return project._id
  },
})
