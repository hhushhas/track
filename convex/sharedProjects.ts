import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireAuthenticatedActor } from './lib/actorContext'
import {
  requireActiveRelationshipParticipant,
  requireActiveCompanyMembership,
  requireCompanyAdmin,
  requireCompanyModelEnabled,
  requireCompanyProjectManager,
  resolveCompanyProjectAccess,
} from './lib/companyPolicy'
import {
  createInvitationToken,
  hashInvitationToken,
  invitationLifetimeMs,
} from './lib/companyInvitations'
import {
  bumpProjectParticipants,
  createCompanyProjectMembership,
  requireEligibleCompanyUser,
} from './lib/companyProjectLifecycle'
import { removeTaskMemberFromScope } from './lib/taskLifecycle'

const initialMember = v.object({
  userId: v.id('users'),
  role: v.union(v.literal('manager'), v.literal('member')),
})

const representedProjectLimit = 200
const overviewMemberLimit = 500
const overviewParticipantLimit = 100

export const listForActingCompany = query({
  args: { actingCompanyId: v.id('companies') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId)
    const [activeMemberships, archivedMemberships] = await Promise.all([
      ctx.db.query('projectMembers').withIndex('by_user_company_status', (q) =>
        q.eq('userId', actor.userId).eq('companyId', args.actingCompanyId).eq('status', 'active'),
      ).take(representedProjectLimit + 1),
      ctx.db.query('projectMembers').withIndex('by_user_company_status', (q) =>
        q.eq('userId', actor.userId).eq('companyId', args.actingCompanyId).eq('status', 'archived'),
      ).take(representedProjectLimit + 1),
    ])
    const represented = [...activeMemberships, ...archivedMemberships]
    if (represented.length > representedProjectLimit) {
      throw new Error('accessible_project_list_limit_exceeded')
    }
    return await Promise.all(represented.map(async (membership) => {
      try {
        const access = await resolveCompanyProjectAccess(ctx, actor, {
          actingCompanyId: args.actingCompanyId,
          projectId: membership.projectId,
          projectMemberId: membership._id,
        })
        return {
          project: access.entitlement?.projectSnapshot ?? access.project,
          membership: access.projectMember,
          representedCompanyId: args.actingCompanyId,
        }
      } catch {
        return null
      }
    })).then((items) => items.filter((item) => item !== null))
  },
})

export const getOverview = query({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveCompanyProjectAccess(ctx, actor, args)
    if (access.entitlement) {
      const memberSnapshots = (access.entitlement.memberSnapshots ?? []) as Array<{
        membership: { role: string }
        user?: { _id: Id<'users'>; displayName: string } | null
        company?: { _id: Id<'companies'>; displayName: string } | null
      }>
      const archivedCompanies = new Map<string, { _id: Id<'companies'>; displayName: string }>()
      for (const snapshot of memberSnapshots) {
        if (snapshot.company) archivedCompanies.set(String(snapshot.company._id), snapshot.company)
      }
      const archivedManagers = memberSnapshots
        .filter((snapshot) => snapshot.membership.role === 'manager' && snapshot.user)
        .map((snapshot) => snapshot.user!)
      return {
        project: access.entitlement.projectSnapshot as typeof access.project,
        creator: null,
        companies: [...archivedCompanies.values()].slice(0, overviewParticipantLimit),
        participantsTruncated: archivedCompanies.size > overviewParticipantLimit,
        managers: archivedManagers.slice(0, 20),
        managersTruncated: archivedManagers.length > 20,
        memberCount: Math.min(memberSnapshots.length, overviewMemberLimit),
        memberCountTruncated: memberSnapshots.length > overviewMemberLimit,
      }
    }
    const [participants, activeMembers, creator] = await Promise.all([
      ctx.db.query('projectCompanies').withIndex('by_project_status', (q) =>
        q.eq('projectId', access.project._id).eq('status', 'active'),
      ).take(overviewParticipantLimit + 1),
      ctx.db.query('projectMembers').withIndex('by_project_status', (q) =>
        q.eq('projectId', access.project._id).eq('status', 'active'),
      ).take(overviewMemberLimit + 1),
      ctx.db.get(access.project.createdBy),
    ])
    const companies = await Promise.all(participants.slice(0, overviewParticipantLimit).map(async (participant) => {
      const company = await ctx.db.get(participant.companyId)
      return company ? {
        _id: company._id,
        displayName: company.displayName,
        status: company.status,
      } : null
    }))
    const managerMemberships = activeMembers
      .slice(0, overviewMemberLimit)
      .filter((membership) => membership.role === 'manager')
    const managers = await Promise.all(managerMemberships.slice(0, 20).map(async (membership) => {
      const user = await ctx.db.get(membership.userId)
      return user ? { _id: user._id, displayName: user.displayName } : null
    }))
    return {
      project: access.project,
      creator: creator ? { _id: creator._id, displayName: creator.displayName } : null,
      companies: companies.filter((company) => company !== null),
      participantsTruncated: participants.length > overviewParticipantLimit,
      managers: managers.filter((manager) => manager !== null),
      managersTruncated: managerMemberships.length > 20,
      memberCount: Math.min(activeMembers.length, overviewMemberLimit),
      memberCountTruncated: activeMembers.length > overviewMemberLimit,
    }
  },
})

export const listInvitations = query({
  args: { actingCompanyId: v.id('companies') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const invitations = await ctx.db
      .query('projectCompanyInvitations')
      .withIndex('by_target_status', (q) => q.eq('targetCompanyId', args.actingCompanyId).eq('status', 'pending'))
      .collect()
    return await Promise.all(invitations.map(async (invitation) => {
      const [project, invitingCompany] = await Promise.all([
        ctx.db.get(invitation.projectId),
        ctx.db.get(invitation.invitingCompanyId),
      ])
      return {
        invitation,
        project: project ? { _id: project._id, name: project.name, description: project.description } : null,
        invitingCompany: invitingCompany ? { _id: invitingCompany._id, displayName: invitingCompany.displayName } : null,
      }
    }))
  },
})

export const createCompanyProject = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const name = args.name.trim()
    const description = args.description?.trim() || undefined
    if (!name) throw new Error('project_name_required')
    if (name.length > 120) throw new Error('project_name_too_long')
    if (description && description.length > 2_000) throw new Error('project_description_too_long')
    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      name,
      description,
      accessProfile: 'company',
      proposingCompanyId: company._id,
      origin: 'single_company',
      status: 'active',
      participantRevision: 1,
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    const projectCompanyId = await ctx.db.insert('projectCompanies', {
      projectId,
      companyId: company._id,
      term: 1,
      status: 'active',
      acceptedBy: actor.userId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'general',
      name: 'General',
      status: 'active',
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    const projectMember = await createCompanyProjectMembership(ctx, {
      projectId,
      projectCompanyId,
      companyId: company._id,
      companyDisplayName: company.displayName,
      userId: actor.userId,
      role: 'manager',
      invitedBy: actor.userId,
    })
    await appendAuditEvent(ctx, {
      companyId: company._id, projectId, groupId, actorId: actor.userId,
      actorProjectMemberId: projectMember._id, actingCompanyId: company._id,
      entityType: 'project', entityId: projectId, action: 'project.created',
      after: { name, description, accessProfile: 'company', projectCompanyId, projectMemberId: projectMember._id, groupId },
    })
    return { projectId, projectCompanyId, projectMemberId: projectMember._id, groupId }
  },
})

export const propose = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    relationshipId: v.id('relationships'),
    name: v.string(),
    description: v.optional(v.string()),
    initialMembers: v.array(initialMember),
    targetCompanyIds: v.array(v.id('companies')),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    await requireActiveRelationshipParticipant(ctx, args.relationshipId, company._id)
    const relationship = await ctx.db.get(args.relationshipId)
    if (!relationship || relationship.status !== 'active') throw new Error('relationship_unavailable')
    const targetCompanyIds = Array.from(new Set(args.targetCompanyIds)).filter((id) => id !== company._id)
    if (targetCompanyIds.length === 0) throw new Error('shared_project_target_required')
    for (const targetCompanyId of targetCompanyIds) {
      await requireActiveRelationshipParticipant(ctx, relationship._id, targetCompanyId)
      const targetCompany = await ctx.db.get(targetCompanyId)
      if (!targetCompany || targetCompany.status !== 'active') throw new Error('mapped_company_unavailable')
    }
    const initialMemberMap = new Map(args.initialMembers.map((member) => [member.userId, member]))
    initialMemberMap.set(actor.userId, { userId: actor.userId, role: 'manager' })
    const initialMembers = Array.from(initialMemberMap.values())
    for (const member of initialMembers) {
      await requireEligibleCompanyUser(ctx, company._id, member.userId)
    }
    const name = args.name.trim()
    if (!name) throw new Error('project_name_required')
    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      name,
      description: args.description?.trim() || undefined,
      accessProfile: 'company',
      relationshipId: relationship._id,
      proposingCompanyId: company._id,
      origin: 'shared',
      status: 'proposed',
      participantRevision: 1,
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    const projectCompanyId = await ctx.db.insert('projectCompanies', {
      projectId,
      companyId: company._id,
      term: 1,
      status: 'active',
      acceptedBy: actor.userId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const generalGroupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'general',
      name: 'General',
      status: 'active',
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    const createdMemberships = []
    for (const member of initialMembers) {
      createdMemberships.push(await createCompanyProjectMembership(ctx, {
        projectId,
        projectCompanyId,
        companyId: company._id,
        companyDisplayName: company.displayName,
        userId: member.userId,
        role: member.role,
        invitedBy: actor.userId,
      }))
    }
    const invitations = []
    for (const targetCompanyId of targetCompanyIds) {
      const token = createInvitationToken()
      const invitationId = await ctx.db.insert('projectCompanyInvitations', {
        projectId,
        targetCompanyId,
        invitingCompanyId: company._id,
        invitedBy: actor.userId,
        tokenHash: await hashInvitationToken(token),
        status: 'pending',
        expiresAt: now + invitationLifetimeMs,
        createdAt: now,
        updatedAt: now,
      })
      invitations.push({ invitationId, targetCompanyId, token })
    }
    await appendAuditEvent(ctx, {
      companyId: company._id,
      relationshipId: relationship._id,
      projectId,
      actorId: actor.userId,
      actingCompanyId: company._id,
      entityType: 'project',
      entityId: projectId,
      action: 'shared_project.proposed',
      after: {
        name,
        targetCompanyIds,
        creatorProjectMemberId: createdMemberships.find((member) => member.userId === actor.userId)?._id,
        generalGroupId,
      },
    })
    return { projectId, invitations }
  },
})

export const decideInvitation = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    invitationId: v.id('projectCompanyInvitations'),
    decision: v.union(v.literal('accept'), v.literal('decline')),
    initialMembers: v.array(initialMember),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation || invitation.targetCompanyId !== company._id || invitation.status !== 'pending') {
      return invitation?._id ?? null
    }
    const now = Date.now()
    if (invitation.expiresAt <= now) {
      await ctx.db.patch(invitation._id, { status: 'expired', updatedAt: now })
      await appendAuditEvent(ctx, {
        companyId: company._id, projectId: invitation.projectId, actorId: actor.userId,
        actingCompanyId: company._id, entityType: 'projectCompanyInvitation', entityId: invitation._id,
        action: 'project_company_invitation.expired', before: { status: 'pending' }, after: { status: 'expired' },
      })
      return { invitationId: invitation._id, status: 'expired' as const }
    }
    if (args.decision === 'decline') {
      await ctx.db.patch(invitation._id, { status: 'declined', decidedBy: actor.userId, decidedAt: now, updatedAt: now })
      await appendAuditEvent(ctx, {
        companyId: company._id, projectId: invitation.projectId, actorId: actor.userId,
        actingCompanyId: company._id, entityType: 'projectCompanyInvitation', entityId: invitation._id,
        action: 'project_company_invitation.declined', before: { status: 'pending' }, after: { status: 'declined' },
      })
      return invitation._id
    }
    if (!args.initialMembers.some((member) => member.role === 'manager')) throw new Error('initial_manager_required')
    const [project, invitingCompany] = await Promise.all([
      ctx.db.get(invitation.projectId),
      ctx.db.get(invitation.invitingCompanyId),
    ])
    if (
      !project ||
      !project.relationshipId ||
      project.accessProfile !== 'company' ||
      (project.status !== 'proposed' && project.status !== 'active') ||
      !invitingCompany ||
      invitingCompany.status !== 'active'
    ) throw new Error('project_unavailable')
    await requireActiveRelationshipParticipant(ctx, project.relationshipId, company._id)
    for (const member of args.initialMembers) await requireEligibleCompanyUser(ctx, company._id, member.userId)
    const terms = await ctx.db
      .query('projectCompanies')
      .withIndex('by_project_company_term', (q) => q.eq('projectId', project._id).eq('companyId', company._id))
      .collect()
    let projectCompany = terms.find((term) => term.status === 'active')
    if (!projectCompany) {
      const projectCompanyId = await ctx.db.insert('projectCompanies', {
        projectId: project._id,
        companyId: company._id,
        term: Math.max(0, ...terms.map((term) => term.term)) + 1,
        status: 'active',
        acceptedBy: actor.userId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      projectCompany = await ctx.db.get(projectCompanyId) ?? undefined
    }
    if (!projectCompany) throw new Error('project_participation_failed')
    for (const member of args.initialMembers) {
      await createCompanyProjectMembership(ctx, {
        projectId: project._id,
        projectCompanyId: projectCompany._id,
        companyId: company._id,
        companyDisplayName: company.displayName,
        userId: member.userId,
        role: member.role,
        invitedBy: actor.userId,
      })
    }
    await ctx.db.patch(invitation._id, { status: 'accepted', decidedBy: actor.userId, decidedAt: now, updatedAt: now })
    const participants = await ctx.db
      .query('projectCompanies')
      .withIndex('by_project_status', (q) => q.eq('projectId', project._id).eq('status', 'active'))
      .collect()
    await bumpProjectParticipants(ctx, project._id, now)
    if (participants.length >= 2 && project.status === 'proposed') {
      await ctx.db.patch(project._id, { status: 'active', updatedAt: now })
    }
    await appendAuditEvent(ctx, {
      companyId: company._id, projectId: project._id, actorId: actor.userId,
      actingCompanyId: company._id, entityType: 'projectCompanyInvitation', entityId: invitation._id,
      action: 'project_company_invitation.accepted', before: { status: 'pending' },
      after: { status: 'accepted', projectCompanyId: projectCompany._id },
    })
    return invitation._id
  },
})

export const revokeInvitation = mutation({
  args: {
    actingCompanyId: v.id('companies'),
    invitationId: v.id('projectCompanyInvitations'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireCompanyAdmin(ctx, actor, args.actingCompanyId)
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation || invitation.invitingCompanyId !== company._id) throw new Error('invitation_unavailable')
    if (invitation.status !== 'pending') return invitation._id
    const now = Date.now()
    await ctx.db.patch(invitation._id, { status: 'revoked', decidedBy: actor.userId, decidedAt: now, updatedAt: now })
    await appendAuditEvent(ctx, {
      companyId: company._id, projectId: invitation.projectId, actorId: actor.userId,
      actingCompanyId: company._id, entityType: 'projectCompanyInvitation', entityId: invitation._id,
      action: 'project_company_invitation.revoked', before: { status: 'pending' }, after: { status: 'revoked' },
    })
    return invitation._id
  },
})

export const listMembers = query({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyProjectManager(ctx, actor, args)
    const memberships = (await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect())
      .filter((membership) => membership.companyId === args.actingCompanyId && membership.status !== 'removed')
    return await Promise.all(memberships.map(async (membership) => {
      const user = await ctx.db.get(membership.userId)
      return { membership, user: user ? { _id: user._id, displayName: user.displayName } : null }
    }))
  },
})

export const addMember = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    userId: v.id('users'),
    role: v.union(v.literal('manager'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireCompanyProjectManager(ctx, actor, args)
    const membership = await createCompanyProjectMembership(ctx, {
      projectId: access.project._id,
      projectCompanyId: access.projectCompany._id,
      companyId: access.company._id,
      companyDisplayName: access.company.displayName,
      userId: args.userId,
      role: args.role,
      invitedBy: actor.userId,
    })
    await appendAuditEvent(ctx, {
      companyId: access.company._id, projectId: access.project._id, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.company._id,
      entityType: 'projectMember', entityId: membership._id, action: 'project_member.added',
      after: { userId: args.userId, role: args.role, status: membership.status },
    })
    return membership._id
  },
})

export const updateMember = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    targetProjectMemberId: v.id('projectMembers'),
    role: v.optional(v.union(v.literal('manager'), v.literal('member'))),
    status: v.optional(v.union(v.literal('active'), v.literal('suspended'), v.literal('removed'))),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyProjectManager(ctx, actor, args)
    const target = await ctx.db.get(args.targetProjectMemberId)
    if (!target || target.projectId !== args.projectId || target.companyId !== args.actingCompanyId) {
      throw new Error('project_member_unavailable')
    }
    const removesManager = target.role === 'manager' && (args.role === 'member' || args.status === 'suspended' || args.status === 'removed')
    if (removesManager) {
      const managers = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_company_status', (q) =>
          q.eq('projectId', args.projectId).eq('companyId', args.actingCompanyId).eq('status', 'active'),
        )
        .collect()
      if (managers.filter((manager) => manager.role === 'manager').length <= 1) throw new Error('last_project_manager')
      const stewardMemberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) =>
          q.eq('projectMemberId', target._id).eq('status', 'active'),
        )
        .collect()
      for (const stewardMembership of stewardMemberships.filter((item) => item.isSteward)) {
        const channelMemberships = await ctx.db
          .query('groupMembers')
          .withIndex('by_group', (q) => q.eq('groupId', stewardMembership.groupId))
          .collect()
        const otherCompanyMembers = await Promise.all(channelMemberships
          .filter((item) => item.status === 'active' && item.projectMemberId !== target._id)
          .map(async (item) => item.projectMemberId ? await ctx.db.get(item.projectMemberId) : null))
        const representedAfterChange =
          (args.status !== 'suspended' && args.status !== 'removed') ||
          otherCompanyMembers.some((member) => member?.companyId === args.actingCompanyId && member.status === 'active')
        const replacementExists = await Promise.all(channelMemberships
          .filter((item) => item.status === 'active' && item.isSteward && item.projectMemberId !== target._id)
          .map(async (item) => item.projectMemberId ? await ctx.db.get(item.projectMemberId) : null))
          .then((members) => members.some((member) =>
            member?.companyId === args.actingCompanyId && member.status === 'active',
          ))
        if (representedAfterChange && !replacementExists) throw new Error('last_channel_steward')
      }
    }
    const now = Date.now()
    await ctx.db.patch(target._id, {
      role: args.role ?? target.role,
      status: args.status ?? target.status,
      endedAt: args.status === 'removed' ? now : args.status === 'active' ? undefined : target.endedAt,
      updatedAt: now,
    })
    if (target.role === 'manager' && args.role === 'member') {
      const stewardMemberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) =>
          q.eq('projectMemberId', target._id).eq('status', 'active'),
        )
        .collect()
      await Promise.all(stewardMemberships.filter((membership) => membership.isSteward).map((membership) =>
        ctx.db.patch(membership._id, { isSteward: false, updatedAt: now }),
      ))
    }
    if (target.role === 'member' && args.role === 'manager') {
      const channelMemberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) =>
          q.eq('projectMemberId', target._id).eq('status', 'active'),
        )
        .collect()
      await Promise.all(channelMemberships.map((membership) =>
        ctx.db.patch(membership._id, { isSteward: true, updatedAt: now }),
      ))
    }
    if (args.status === 'removed' || args.status === 'suspended') {
      await removeTaskMemberFromScope(ctx, {
        projectId: args.projectId, projectMemberId: target._id,
      })
      const channels = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) => q.eq('projectMemberId', target._id).eq('status', 'active'))
        .collect()
      await Promise.all(channels.map((membership) =>
        ctx.db.patch(membership._id, {
          status: args.status === 'suspended' ? 'suspended' : 'removed',
          endedByProjectMembership: true,
          endedAt: now,
          updatedAt: now,
        }),
      ))
    } else if (args.status === 'active' && (target.status === 'suspended' || target.status === 'removed')) {
      const channels = await ctx.db
        .query('groupMembers')
        .withIndex('by_project_member_status', (q) => q.eq('projectMemberId', target._id).eq('status', target.status))
        .collect()
      const restoredRole = args.role ?? target.role
      await Promise.all(channels.filter((membership) => membership.endedByProjectMembership).map((membership) =>
        ctx.db.patch(membership._id, {
          status: 'active',
          isSteward: restoredRole === 'manager' ? true : membership.isSteward,
          endedByProjectMembership: false,
          endedAt: undefined,
          updatedAt: now,
        }),
      ))
    }
    await appendAuditEvent(ctx, {
      companyId: args.actingCompanyId, projectId: args.projectId, actorId: actor.userId,
      actorProjectMemberId: args.projectMemberId, actingCompanyId: args.actingCompanyId,
      entityType: 'projectMember', entityId: target._id,
      action: args.status === 'suspended' ? 'project_member.suspended'
        : args.status === 'removed' ? 'project_member.removed'
          : args.status === 'active' ? 'project_member.reactivated' : 'project_member.role_changed',
      before: { role: target.role, status: target.status },
      after: { role: args.role ?? target.role, status: args.status ?? target.status },
    })
    return target._id
  },
})

export const listEligibleCompanyMembers = query({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyProjectManager(ctx, actor, args)
    const memberships = await ctx.db
      .query('companyMembers')
      .withIndex('by_company', (q) => q.eq('companyId', args.actingCompanyId))
      .take(501)
    if (memberships.length > 500) throw new Error('company_member_list_limit_exceeded')
    return await Promise.all(memberships
      .filter((membership) => membership.status === 'active')
      .map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return {
          membership: {
            _id: membership._id,
            userId: membership.userId,
            status: membership.status,
          },
          user: user ? { _id: user._id, displayName: user.displayName } : null,
        }
      }))
  },
})

export const updateDetails = mutation({
  args: {
    projectId: v.id('projects'),
    actingCompanyId: v.id('companies'),
    projectMemberId: v.id('projectMembers'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    label: v.optional(v.string()),
    iconStorageId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    const access = await requireCompanyProjectManager(ctx, actor, args)
    if (args.name === undefined && args.description === undefined && args.label === undefined && args.iconStorageId === undefined) {
      throw new Error('project_update_required')
    }
    const name = args.name === undefined ? access.project.name : args.name.trim()
    const description = args.description === undefined ? access.project.description : args.description.trim() || undefined
    const clientLabel = args.label === undefined ? access.project.clientLabel : args.label.trim() || undefined
    if (!name) throw new Error('project_name_required')
    if (name.length > 120) throw new Error('project_name_too_long')
    if (description && description.length > 2_000) throw new Error('project_description_too_long')
    if (clientLabel && clientLabel.length > 80) throw new Error('project_label_too_long')
    if (args.iconStorageId) {
      const metadata = await ctx.storage.getMetadata(args.iconStorageId)
      if (!metadata || metadata.size > 5_000_000 || !metadata.contentType?.startsWith('image/')) {
        throw new Error('project_icon_invalid')
      }
    }
    const iconStorageId = args.iconStorageId === undefined
      ? access.project.iconStorageId
      : args.iconStorageId ?? undefined
    const now = Date.now()
    await ctx.db.patch(access.project._id, {
      name, description, clientLabel, iconStorageId,
      revision: (access.project.revision ?? 0) + 1,
      updatedAt: now,
    })
    await appendAuditEvent(ctx, {
      companyId: access.company._id, projectId: access.project._id, actorId: actor.userId,
      actorProjectMemberId: access.projectMember._id, actingCompanyId: access.company._id,
      entityType: 'project', entityId: access.project._id, action: 'project.updated',
      before: { name: access.project.name, description: access.project.description, label: access.project.clientLabel, iconStorageId: access.project.iconStorageId },
      after: { name, description, label: clientLabel, iconStorageId },
    })
    return access.project._id
  },
})

export const generateIconUploadUrl = mutation({
  args: { projectId: v.id('projects'), actingCompanyId: v.id('companies'), projectMemberId: v.id('projectMembers') },
  handler: async (ctx, args) => {
    requireCompanyModelEnabled()
    const actor = await requireAuthenticatedActor(ctx)
    await requireCompanyProjectManager(ctx, actor, args)
    return await ctx.storage.generateUploadUrl()
  },
})
