import { v } from 'convex/values'
import { resolveProjectAccessProfile } from '@track/shared/feature-flags'

import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { appendAuditEvent } from './lib/audit'
import { assertActorMatches, requireAuthenticatedActor } from './lib/actorContext'
import { canRoleJoinDefaultGroup, requireProjectManager, requireProjectMember, requireProjectOwner } from './lib/permissions'
import { invalidateTaskEvidence } from './lib/taskEvidence'
import { deleteTaskProjectData } from './lib/taskLifecycle'

const defaultGroups = [
  { kind: 'general', name: 'General' },
  { kind: 'internal', name: 'Internal' },
  { kind: 'commercials', name: 'Commercials' },
] as const
const accessibleProjectLimit = 200
const accessibleChannelMembershipLimit = 1_000
const accessibleProjectMemberCountLimit = 500

export const listAccessible = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireAuthenticatedActor(ctx)
    const [activeMemberships, archivedMemberships, legacyMemberships, activeLegacyGroupMemberships, legacyGroupMembershipsWithoutStatus] = await Promise.all([
      ctx.db.query('projectMembers').withIndex('by_user_status', (q) => q.eq('userId', actor.userId).eq('status', 'active')).take(accessibleProjectLimit + 1),
      ctx.db.query('projectMembers').withIndex('by_user_status', (q) => q.eq('userId', actor.userId).eq('status', 'archived')).take(accessibleProjectLimit + 1),
      ctx.db.query('projectMembers').withIndex('by_user_status', (q) => q.eq('userId', actor.userId).eq('status', undefined)).take(accessibleProjectLimit + 1),
      ctx.db.query('groupMembers').withIndex('by_user_status', (q) => q.eq('userId', actor.userId).eq('status', 'active')).take(accessibleChannelMembershipLimit + 1),
      ctx.db.query('groupMembers').withIndex('by_user_status', (q) => q.eq('userId', actor.userId).eq('status', undefined)).take(accessibleChannelMembershipLimit + 1),
    ])
    const memberships = [...activeMemberships, ...archivedMemberships, ...legacyMemberships]
    const legacyGroupMemberships = [...activeLegacyGroupMemberships, ...legacyGroupMembershipsWithoutStatus]
    if (memberships.length > accessibleProjectLimit || legacyGroupMemberships.length > accessibleChannelMembershipLimit) {
      throw new Error('accessible_project_list_limit_exceeded')
    }
    const items = await Promise.all(memberships.map(async (membership) => {
      const project = await ctx.db.get(membership.projectId)
      if (!project) return null
      const accessProfile = resolveProjectAccessProfile(project.accessProfile)
      if (accessProfile === 'legacy') {
        if (membership.status !== undefined && membership.status !== 'active') return null
        if (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'staff' && membership.role !== 'client') return null
      } else {
        if (
          !membership.companyId || !membership.projectCompanyId ||
          (membership.role !== 'manager' && membership.role !== 'member') ||
          (membership.status !== 'active' && membership.status !== 'archived')
        ) return null
      }

      const company = membership.companyId ? await ctx.db.get(membership.companyId) : null
      const projectCompany = membership.projectCompanyId ? await ctx.db.get(membership.projectCompanyId) : null
      let archiveEntitlement = null
      if (accessProfile === 'company') {
        const companyMembership = membership.companyId
          ? await ctx.db.query('companyMembers').withIndex('by_company_user', (q) =>
              q.eq('companyId', membership.companyId!).eq('userId', actor.userId),
            ).unique()
          : null
        const archiveMode = membership.status === 'archived'
        if (
          !company || company.status !== 'active' ||
          !companyMembership || companyMembership.status !== 'active' ||
          !projectCompany || projectCompany.projectId !== project._id ||
          projectCompany.companyId !== company._id ||
          (archiveMode ? projectCompany.status !== 'exited' : projectCompany.status !== 'active')
        ) return null
        if (archiveMode) {
          archiveEntitlement = await ctx.db.query('projectArchiveEntitlements')
            .withIndex('by_member', (q) => q.eq('projectMemberId', membership._id)).unique()
          if (archiveEntitlement?.retentionStatus !== 'active') return null
        }
        if (!archiveMode && project.origin === 'shared' && project.relationshipId) {
          const [relationship, relationshipTerms] = await Promise.all([
            ctx.db.get(project.relationshipId),
            ctx.db.query('relationshipCompanies').withIndex('by_relationship_status', (q) =>
              q.eq('relationshipId', project.relationshipId!).eq('status', 'active'),
            ).collect(),
          ])
          if (
            !relationship || relationship.status !== 'active' ||
            !relationshipTerms.some((term) => term.companyId === company._id)
          ) return null
        }
      }

      const channelMembershipRows = accessProfile === 'company' && membership.status !== 'archived'
        ? await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', membership._id).eq('status', membership.status === 'archived' ? 'archived' : 'active'),
          ).take(accessibleChannelMembershipLimit + 1)
        : legacyGroupMemberships.filter((item) =>
            item.projectId === project._id && (!item.status || item.status === 'active'),
          )
      const channelMemberships = channelMembershipRows.slice(0, accessibleChannelMembershipLimit)
      const channelCountTruncated = channelMembershipRows.length > accessibleChannelMembershipLimit
      const [visibleGroups, activeMembers] = await Promise.all([
        membership.status === 'archived' && archiveEntitlement
          ? Promise.all(archiveEntitlement.channelIds.map(async (groupId) => await ctx.db.get(groupId)))
          : Promise.all(channelMemberships.map(async (item) => await ctx.db.get(item.groupId))),
        archiveEntitlement
          ? Promise.resolve([])
          : accessProfile === 'legacy'
          ? ctx.db.query('projectMembers').withIndex('by_project', (q) =>
              q.eq('projectId', project._id),
            ).take(accessibleProjectMemberCountLimit + 1)
          : ctx.db.query('projectMembers').withIndex('by_project_status', (q) =>
              q.eq('projectId', project._id).eq('status', 'active'),
            ).take(accessibleProjectMemberCountLimit + 1),
      ])
      const readableGroups = visibleGroups.filter(
        (group): group is NonNullable<typeof group> => Boolean(group && group.projectId === project._id),
      )
      const readableLastMessages = await Promise.all(readableGroups.map(async (group) =>
        await ctx.db.query('messages').withIndex('by_group_created_at', (q) =>
          archiveEntitlement
            ? q.eq('groupId', group._id).lte('createdAt', archiveEntitlement.exitAt)
            : q.eq('groupId', group._id),
        ).order('desc').first(),
      ))
      const channelCount = readableGroups.length
      const lastReadableMessageAt = Math.max(0, ...readableLastMessages.map((message) => message?.createdAt ?? 0))
      const archivedMembers = archiveEntitlement?.memberSnapshots ?? []
      const visibleProject = archiveEntitlement?.projectSnapshot ?? project
      return {
        project: visibleProject,
        membership,
        projectCompany,
        company: company ? {
          _id: company._id,
          displayName: company.displayName,
          normalizedHandle: company.normalizedHandle,
          logoStorageId: company.logoStorageId,
          status: company.status,
        } : null,
        role: membership.role,
        projectStatus: visibleProject.status ?? 'active',
        projectType: accessProfile === 'legacy' ? 'legacy' as const : project.origin === 'shared' ? 'shared' as const : 'company' as const,
        memberCount: Math.min(
          archiveEntitlement
            ? archivedMembers.length
            : activeMembers.filter((item) => !item.status || item.status === 'active').length,
          accessibleProjectMemberCountLimit,
        ),
        memberCountTruncated: archiveEntitlement
          ? archivedMembers.length > accessibleProjectMemberCountLimit
          : activeMembers.length > accessibleProjectMemberCountLimit,
        channelCount,
        channelCountTruncated,
        lastActivityAt: Math.max(
          archiveEntitlement ? Math.min(project.updatedAt, archiveEntitlement.exitAt) : project.updatedAt,
          lastReadableMessageAt,
        ),
      }
    }))
    return items.filter((item) => item !== null)
  },
})

export const list = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const projects = await Promise.all(
      memberships.map(async (membership) => {
        const project = await ctx.db.get(membership.projectId)
        return project && (!project.accessProfile || project.accessProfile === 'legacy') ? { project, membership } : null
      }),
    )

    return projects.filter((project) => project !== null)
  },
})

export const listMembers = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    await requireProjectMember(ctx, args.projectId, args.userId)
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()

    return await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return { membership, user }
      }),
    )
  },
})

export const create = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    clientLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const now = Date.now()
    const existingMembership = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    if (existingMembership) {
      const existingProject = await ctx.db.get(existingMembership.projectId)
      if (
        existingProject &&
        existingMembership.role !== 'owner' &&
        existingMembership.role !== 'admin'
      ) {
        throw new Error('not_allowed_to_create_project')
      }
    }

    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      clientLabel: args.clientLabel,
      accessProfile: 'legacy',
      origin: 'single_company',
      status: 'active',
      participantRevision: 0,
      revision: 1,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    })

    const projectMemberId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: args.userId,
      role: 'owner',
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })

    for (const group of defaultGroups) {
      const groupId = await ctx.db.insert('groups', {
        projectId,
        kind: group.kind,
        name: group.name,
        status: 'active',
        revision: 1,
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      })

      if (canRoleJoinDefaultGroup('owner', group.kind)) {
        await ctx.db.insert('groupMembers', {
          projectId,
          groupId,
          userId: args.userId,
          projectMemberId,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    await appendAuditEvent(ctx, {
      projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      after: { name: args.name, clientLabel: args.clientLabel },
    })

    return projectId
  },
})

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    name: v.string(),
    clientLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    await requireProjectManager(ctx, args.projectId, args.userId)
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('project_not_found')
    const name = args.name.trim()
    if (!name) throw new Error('project_name_required')
    const clientLabel = args.clientLabel?.trim() || undefined

    await ctx.db.patch(args.projectId, {
      name,
      clientLabel,
      updatedAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: args.projectId,
      action: 'project.updated',
      before: { name: project.name, clientLabel: project.clientLabel },
      after: { name, clientLabel },
    })
  },
})

export const remove = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    await requireProjectOwner(ctx, args.projectId, args.userId)
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('project_not_found')

    const [
      groups,
      projectMembers,
      invitations,
      messages,
      attachments,
      typingIndicators,
      assistantStreams,
      auditEvents,
      groupNotificationSettings,
      memoryBoxes,
      memoryImports,
      memoryPathLocks,
      channelThreads,
      channelThreadFollowers,
      channelThreadReadStates,
    ] = await Promise.all([
      ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
      Promise.all(
        (['pending', 'accepted', 'revoked', 'expired'] as const).map((status) =>
          ctx.db.query('invitations').withIndex('by_project_status', (q) => q.eq('projectId', args.projectId).eq('status', status)).collect(),
        ),
      ).then((rows) => rows.flat()),
      ctx.db.query('messages').withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('attachments').collect(),
      ctx.db.query('typingIndicators').collect(),
      ctx.db.query('assistantStreams').collect(),
      ctx.db.query('auditEvents').withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('groupNotificationSettings').collect(),
      ctx.db.query('projectMemoryBoxes').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('memoryImports').withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('memoryPathLocks').collect(),
      ctx.db.query('channelThreads').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('channelThreadFollowers').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
      ctx.db.query('channelThreadReadStates').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
    ])
    const groupIds = new Set(groups.map((group) => group._id))

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: args.projectId,
      action: 'project.deleted',
      before: { name: project.name, clientLabel: project.clientLabel },
    })

    const projectAttachments = attachments.filter((attachment) => attachment.projectId === args.projectId)
    await Promise.all(projectAttachments.map((attachment) => ctx.storage.delete(attachment.storageId).catch(() => undefined)))
    for (const message of messages) await invalidateTaskEvidence(ctx, { messageId: message._id })
    for (const attachment of projectAttachments) await invalidateTaskEvidence(ctx, { attachmentId: attachment._id })
    for (const stream of assistantStreams.filter((candidate) => candidate.projectId === args.projectId)) {
      await invalidateTaskEvidence(ctx, { assistantStreamId: stream._id })
    }
    await deleteTaskProjectData(ctx, args.projectId)
    for (const row of memoryBoxes) {
      await ctx.scheduler.runAfter(0, (internal as any).memoryActions.deleteMemoryBoxById, {
        actorId: args.userId,
        boxId: row.boxId,
        projectId: args.projectId,
      })
    }

    for (const row of groupNotificationSettings) {
      if (groupIds.has(row.groupId)) await ctx.db.delete(row._id)
    }
    for (const row of memoryPathLocks) {
      if (row.projectId === args.projectId) await ctx.db.delete(row._id)
    }
    for (const row of memoryImports) await ctx.db.delete(row._id)
    for (const row of memoryBoxes) await ctx.db.delete(row._id)
    for (const row of channelThreadReadStates) await ctx.db.delete(row._id)
    for (const row of channelThreadFollowers) await ctx.db.delete(row._id)
    for (const row of channelThreads) await ctx.db.delete(row._id)
    for (const row of assistantStreams) {
      if (row.projectId === args.projectId) await ctx.db.delete(row._id)
    }
    for (const row of typingIndicators) {
      if (row.projectId === args.projectId) await ctx.db.delete(row._id)
    }
    for (const row of projectAttachments) await ctx.db.delete(row._id)
    for (const row of messages) await ctx.db.delete(row._id)
    for (const row of invitations) await ctx.db.delete(row._id)
    for (const row of projectMembers) await ctx.db.delete(row._id)
    for (const row of groups) await ctx.db.delete(row._id)
    for (const row of auditEvents) await ctx.db.delete(row._id)
    await ctx.db.delete(args.projectId)
  },
})

export const ensureStarter = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    const existingMembership = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    if (existingMembership) return existingMembership.projectId

    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      name: 'Default',
      clientLabel: 'Internal product build',
      accessProfile: 'legacy',
      origin: 'single_company',
      status: 'active',
      participantRevision: 0,
      revision: 1,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    })

    const projectMemberId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: args.userId,
      role: 'owner',
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })

    for (const group of defaultGroups) {
      const groupId = await ctx.db.insert('groups', {
        projectId,
        kind: group.kind,
        name: group.name,
        status: 'active',
        revision: 1,
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      })

      await ctx.db.insert('groupMembers', {
        projectId,
        groupId,
        userId: args.userId,
        projectMemberId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }

    await appendAuditEvent(ctx, {
      projectId,
      actorId: args.userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      after: { name: 'Default', clientLabel: 'Internal product build' },
    })

    return projectId
  },
})

export const getOverview = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    assertActorMatches(actor, args.userId)
    await requireProjectMember(ctx, args.projectId, args.userId)
    const project = await ctx.db.get(args.projectId)
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    return {
      project,
      groups,
    }
  },
})
