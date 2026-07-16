import { resolveProjectAccessProfile } from '@track/shared/feature-flags'
import { resolveProjectChannelCapabilities } from '@track/shared/project-policy'
import { resolveTaskCapabilities } from '@track/shared/tasks'

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { AuthenticatedActor } from './actorContext'
import { resolveCompanyProjectAccess } from './companyPolicy'

type TaskPolicyCtx = QueryCtx | MutationCtx

export type TaskRequestIdentity = {
  actingCompanyId?: Id<'companies'>
  projectMemberId?: Id<'projectMembers'>
}

export function requireTasksEnabled() {
  if (process.env.TRACK_TASKS_ENABLED !== 'true') throw new Error('tasks_disabled')
}

function activeLegacyMembership(
  member: Doc<'projectMembers'> | null,
): member is Doc<'projectMembers'> {
  return Boolean(member && member.status !== 'removed' && member.status !== 'suspended')
}

export async function resolveTaskRequestContext(
  ctx: TaskPolicyCtx,
  actor: AuthenticatedActor,
  projectId: Id<'projects'>,
  identity: TaskRequestIdentity,
  groupId?: Id<'groups'>,
) {
  requireTasksEnabled()
  const project = await ctx.db.get(projectId)
  if (!project) throw new Error('task_access_changed')

  if (resolveProjectAccessProfile(project.accessProfile) === 'company') {
    if (!identity.actingCompanyId || !identity.projectMemberId) {
      throw new Error('task_acting_company_required')
    }
    const access = await resolveCompanyProjectAccess(ctx, actor, {
      projectId,
      actingCompanyId: identity.actingCompanyId,
      projectMemberId: identity.projectMemberId,
      groupId,
    })
    return {
      actor,
      project,
      projectMember: access.projectMember,
      actingCompanyId: identity.actingCompanyId,
      group: access.group,
      entitlement: access.entitlement,
      capabilities: access.capabilities,
    }
  }

  const projectMember = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) => q.eq('projectId', projectId).eq('userId', actor.userId))
    .unique()
  if (!activeLegacyMembership(projectMember)) throw new Error('task_access_changed')

  const group = groupId ? await ctx.db.get(groupId) : null
  if (groupId && (!group || group.projectId !== projectId)) throw new Error('task_access_changed')
  const groupMember = groupId
    ? await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', actor.userId))
        .unique()
    : null
  const archiveMode = projectMember.status === 'archived' || project.status === 'archived'
  const channelMember = !groupId || Boolean(
    groupMember && groupMember.status !== 'removed' && groupMember.status !== 'suspended',
  )
  const capabilities = resolveProjectChannelCapabilities({
    accessProfile: 'legacy',
    accessMode: archiveMode ? 'archive' : 'active',
    projectRole: projectMember.role as 'owner' | 'admin' | 'staff' | 'client',
    channelMember,
    channelActive: !group?.status || group.status === 'active',
    channelSteward: groupMember?.isSteward,
  })
  return {
    actor,
    project,
    projectMember,
    actingCompanyId: undefined,
    group,
    entitlement: null,
    capabilities,
  }
}

export async function requireTaskBoardAccess(
  ctx: TaskPolicyCtx,
  actor: AuthenticatedActor,
  boardId: Id<'taskBoards'>,
  identity: TaskRequestIdentity,
) {
  const board = await ctx.db.get(boardId)
  if (!board) throw new Error('task_destination_invalid')
  const access = await resolveTaskRequestContext(ctx, actor, board.projectId, identity, board.groupId)
  const canReadScope = board.groupId
    ? access.capabilities.canReadChannel
    : access.capabilities.canReadProject
  if (!canReadScope) throw new Error('task_access_changed')
  return { ...access, board }
}

export async function requireTaskAccess(
  ctx: TaskPolicyCtx,
  actor: AuthenticatedActor,
  taskId: Id<'tasks'>,
  identity: TaskRequestIdentity,
) {
  const task = await ctx.db.get(taskId)
  if (!task) throw new Error('task_access_changed')
  const access = await resolveTaskRequestContext(ctx, actor, task.projectId, identity, task.groupId)
  const taskCapabilities = resolveTaskCapabilities({
    collaboration: access.capabilities.taskCollaboration,
    activeScope: access.capabilities.accessMode === 'active' && !task.archivedAt,
    channelMember: task.groupId
      ? access.capabilities.canReadChannel
      : access.capabilities.canReadProject,
    createdByActor: task.createdByProjectMemberId === access.projectMember._id,
    assignedToActor: task.assigneeProjectMemberId === access.projectMember._id,
  })
  if (!taskCapabilities.canView) throw new Error('task_access_changed')
  return { ...access, task, taskCapabilities }
}

export async function requireEligibleTaskMember(
  ctx: TaskPolicyCtx,
  input: {
    projectId: Id<'projects'>
    groupId?: Id<'groups'>
    projectMemberId: Id<'projectMembers'>
  },
) {
  const member = await ctx.db.get(input.projectMemberId)
  if (
    !member || member.projectId !== input.projectId ||
    (member.status !== undefined && member.status !== 'active')
  ) throw new Error('task_assignee_invalid')

  if (input.groupId) {
    const channelMember = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_project_member', (q) =>
        q.eq('groupId', input.groupId!).eq('projectMemberId', member._id),
      )
      .unique()
    const legacyChannelMember = channelMember ?? await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', input.groupId!).eq('userId', member.userId))
      .unique()
    if (
      !legacyChannelMember || legacyChannelMember.projectId !== input.projectId ||
      (legacyChannelMember.status !== undefined && legacyChannelMember.status !== 'active')
    ) throw new Error('task_assignee_invalid')
  }
  return member
}

export function assertCanAssignTaskMember(
  actorMemberId: Id<'projectMembers'>,
  assigneeMemberId: Id<'projectMembers'> | undefined,
  canAssignOthers: boolean,
) {
  if (assigneeMemberId && assigneeMemberId !== actorMemberId && !canAssignOthers) {
    throw new Error('task_assignment_forbidden')
  }
}
