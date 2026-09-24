import { v } from 'convex/values'
import { isTerminalTaskState } from '@track/shared/tasks'

import { query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireAuthenticatedActor } from './lib/actorContext'
import { requireActiveCompanyMembership } from './lib/companyPolicy'
import { createTaskRequestScope } from './lib/taskPolicy'
import { requireTaskAccess } from './lib/taskPolicy'
import { deriveProjectTaskMetrics, isCompletedWorkflowState } from './lib/projectOverviewMetrics'
import { companyFeedAuditActions, describeCompanyAuditActivity } from './lib/companyActivityCopy'

const dashboardQuotes = [
  'Better systems build brighter tomorrows.',
  'Clarity turns work into progress.',
  'Great teams make progress visible.',
  'Shared context creates stronger teams.',
  'Small wins build lasting momentum.',
  'Clear work creates confident teams.',
  'Progress begins when everyone sees the path.',
  'Alignment turns effort into momentum.',
  'Good work moves better when context stays connected.',
  'Focused teams create meaningful progress.',
  'Strong collaboration starts with shared clarity.',
  'Make the work clear. Let the progress follow.',
  'Connected teams move with purpose.',
  'Visibility creates accountability. Clarity creates momentum.',
  'Bring the work together. Move the company forward.',
] as const

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'T'
}

function actionLabel(action: string) {
  return action.replaceAll('_', ' ')
}

const overviewDays = v.union(v.literal(7), v.literal(30), v.literal(90))

function localDateKey(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone,
  }).format(timestamp)
}

function addUtcDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

function activityCopy(action: string, taskTitle: string, after: unknown) {
  if (action === 'created') return `created “${taskTitle}”`
  if (action === 'state_changed') return `changed the status of “${taskTitle}”`
  if (action === 'assignee_changed') {
    const assignee = after && typeof after === 'object' && 'assigneeName' in after
      ? String((after as { assigneeName?: unknown }).assigneeName ?? '')
      : ''
    return assignee ? `assigned “${taskTitle}” to ${assignee}` : `updated the assignee for “${taskTitle}”`
  }
  if (action === 'due_date_changed') return `updated the due date for “${taskTitle}”`
  if (action === 'commented') return `commented on “${taskTitle}”`
  if (action === 'archived') return `archived “${taskTitle}”`
  if (action === 'restored') return `restored “${taskTitle}”`
  return `${actionLabel(action)} “${taskTitle}”`
}

/** Project-only dashboard data. Every channel-scoped row is checked against the
 * represented membership before it is included in aggregates or activity. */
export const getProject = query({
  args: {
    actingCompanyId: v.id('companies'),
    days: v.optional(overviewDays),
    projectId: v.id('projects'),
    projectMemberId: v.id('projectMembers'),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const scope = await createTaskRequestScope(ctx, actor, args.projectId, {
      actingCompanyId: args.actingCompanyId,
      projectMemberId: args.projectMemberId,
    })
    if (!scope.project.capabilities.canReadProject) throw new Error('project_unavailable')
    // Archived memberships are served by the immutable Project snapshot flow.
    // Never combine an archive entitlement with live Project rows here.
    if (scope.project.entitlement || scope.project.project.status === 'archived') {
      throw new Error('project_unavailable')
    }

    const [allTasks, workflowStates, members, groupMemberships, taskActivities, messages, attachments, threads] = await Promise.all([
      ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', args.projectId).eq('archivedAt', undefined)).collect(),
      Promise.all(['backlog', 'unstarted', 'started', 'completed', 'canceled'].map((category) =>
        ctx.db.query('taskWorkflowStates').withIndex('by_project_category', (q) =>
          q.eq('projectId', args.projectId).eq('category', category as 'backlog'),
        ).collect(),
      )).then((groups) => groups.flat()),
      ctx.db.query('projectMembers').withIndex('by_project_status', (q) => q.eq('projectId', args.projectId).eq('status', 'active')).collect(),
      ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
        q.eq('projectMemberId', args.projectMemberId).eq('status', 'active'),
      ).collect(),
      ctx.db.query('taskActivities').withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId)).order('desc').take(120),
      ctx.db.query('messages').withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId)).order('desc').take(120),
      ctx.db.query('attachments').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).order('desc').take(80),
      ctx.db.query('channelThreads').withIndex('by_project', (q) => q.eq('projectId', args.projectId)).collect(),
    ])

    const visibleGroupIds = new Set(groupMemberships.map((membership) => String(membership.groupId)))
    const canSeeGroup = (groupId: Id<'groups'> | undefined) => !groupId || visibleGroupIds.has(String(groupId))
    const tasks = allTasks.filter((task) => canSeeGroup(task.groupId))
    const visibleTaskIds = new Set(tasks.map((task) => String(task._id)))
    const stateById = new Map(workflowStates.map((state) => [String(state._id), state]))
    const memberById = new Map(members.map((member) => [String(member._id), member]))
    const userIds = new Set(members.map((member) => String(member.userId)))
    const users = (await Promise.all(members.map((member) => ctx.db.get(member.userId))))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
    const userById = new Map(users.map((user) => [String(user._id), user]))
    const memberSummaries = await Promise.all(members.slice(0, 6).map(async (member) => {
      const user = userById.get(String(member.userId))
      return user ? {
        id: member._id,
        name: user.displayName,
        avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
      } : null
    }))

    const timeZone = actor.user.timezone || 'UTC'
    const today = localDateKey(Date.now(), timeZone)
    const dueThrough = addUtcDays(today, 7)
    const days = args.days ?? 30
    const startDate = addUtcDays(today, -(days - 1))
    const completedTasks = tasks.filter((task) => {
      const state = stateById.get(String(task.workflowStateId))
      return isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined)
    })
    const open = tasks.filter((task) => {
      const state = stateById.get(String(task.workflowStateId))
      return !isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined) && state?.category !== 'canceled'
    })
    const blocked = open.filter((task) => stateById.get(String(task.workflowStateId))?.name.trim().toLocaleLowerCase() === 'blocked')
    const overdue = open.filter((task) => task.dueDate && task.dueDate < today)
    const stats = deriveProjectTaskMetrics(tasks.map((task) => {
      const state = stateById.get(String(task.workflowStateId))
      return { category: state?.category ?? 'unstarted', dueDate: task.dueDate, stateName: state?.name ?? 'To do' }
    }), today, dueThrough)

    const attention = open.flatMap((task) => {
      const state = stateById.get(String(task.workflowStateId))
      const isBlocked = state?.name.trim().toLocaleLowerCase() === 'blocked'
      const isOverdue = Boolean(task.dueDate && task.dueDate < today)
      const reason = isBlocked ? 'Blocked task' : isOverdue ? 'Past due date' : !task.assigneeProjectMemberId ? 'No assignee' : !task.dueDate ? 'Project task needs a due date' : null
      if (!reason) return []
      const assignee = task.assigneeProjectMemberId ? memberById.get(String(task.assigneeProjectMemberId)) : null
      const assigneeUser = assignee ? userById.get(String(assignee.userId)) : null
      return [{
        id: task._id, publicKey: task.publicKey, title: task.title, status: state?.name ?? 'To do', assignee: assigneeUser?.displayName ?? null,
        dueDate: task.dueDate ?? null, reason, priority: isBlocked ? 0 : isOverdue ? 1 : !task.assigneeProjectMemberId ? 2 : 3,
      }]
    }).sort((left, right) => left.priority - right.priority || (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999'))

    const trend = Array.from({ length: days }, (_, index) => {
      const date = addUtcDays(startDate, index)
      return {
        date,
        created: tasks.filter((task) => localDateKey(task.createdAt, timeZone) <= date).length,
        completed: completedTasks.filter((task) => task.terminalAt && localDateKey(task.terminalAt, timeZone) <= date).length,
      }
    })
    const currentMonth = today.slice(0, 7)
    const previousMonthDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1))
    const previousMonth = previousMonthDate.toISOString().slice(0, 7)
    const completedThisMonth = completedTasks.filter((task) => task.terminalAt && localDateKey(task.terminalAt, timeZone).startsWith(currentMonth)).length
    const completedLastMonth = completedTasks.filter((task) => task.terminalAt && localDateKey(task.terminalAt, timeZone).startsWith(previousMonth)).length

    type Activity = { id: string; actorId: string; actorName: string; actorInitials: string; copy: string; createdAt: number; kind: 'task' | 'thread' | 'evidence'; taskKey?: string; groupId?: Id<'groups'>; threadId?: Id<'channelThreads'> }
    const activity: Activity[] = []
    for (const entry of taskActivities) {
      if (!visibleTaskIds.has(String(entry.taskId)) || (entry.originalGroupId && !canSeeGroup(entry.originalGroupId))) continue
      const task = tasks.find((candidate) => candidate._id === entry.taskId)
      const member = entry.actorProjectMemberId ? memberById.get(String(entry.actorProjectMemberId)) : null
      const user = member ? userById.get(String(member.userId)) : null
      if (!task || !user) continue
      activity.push({ id: String(entry._id), actorId: String(user._id), actorName: user.displayName, actorInitials: initials(user.displayName), copy: activityCopy(entry.action, task.title, entry.after), createdAt: entry.createdAt, kind: 'task', taskKey: task.publicKey })
    }
    for (const message of messages) {
      if (!canSeeGroup(message.groupId) || !userIds.has(String(message.authorId))) continue
      const user = userById.get(String(message.authorId))
      if (!user) continue
      const thread = message.channelThreadId ? threads.find((candidate) => candidate._id === message.channelThreadId) : null
      activity.push({ id: String(message._id), actorId: String(user._id), actorName: user.displayName, actorInitials: initials(user.displayName), copy: thread ? `replied in “${thread.name}”` : 'added a conversation update', createdAt: message.createdAt, kind: 'thread', groupId: message.groupId, threadId: message.channelThreadId })
    }
    for (const attachment of attachments) {
      if (!canSeeGroup(attachment.groupId) || !userIds.has(String(attachment.uploadedBy))) continue
      const user = userById.get(String(attachment.uploadedBy))
      if (!user) continue
      activity.push({ id: String(attachment._id), actorId: String(user._id), actorName: user.displayName, actorInitials: initials(user.displayName), copy: `attached ${attachment.filename}`, createdAt: attachment.createdAt, kind: 'evidence', groupId: attachment.groupId, threadId: attachment.channelThreadId })
    }
    activity.sort((left, right) => right.createdAt - left.createdAt)

    const visibleThreads = threads.filter((thread) => canSeeGroup(thread.groupId))
      .sort((left, right) => right.updatedAt - left.updatedAt)
    const distribution = workflowStates.map((state) => ({
      id: state._id,
      name: state.name,
      category: state.category,
      count: tasks.filter((task) => task.workflowStateId === state._id).length,
      visualToken: state.visualToken,
    })).filter((state) => state.count > 0)

    const workloadByOwner = new Map<string, { id: string; name: string; initials: string; avatarUrl: string | null; total: number; open: number; completed: number; overdue: number }>()
    for (const task of tasks) {
      const state = stateById.get(String(task.workflowStateId))
      const category = state?.category ?? 'unstarted'
      if (category === 'canceled') continue
      const completed = isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined)
      const member = task.assigneeProjectMemberId ? memberById.get(String(task.assigneeProjectMemberId)) : null
      const user = member ? userById.get(String(member.userId)) : null
      const ownerId = member && user ? String(member._id) : 'unassigned'
      const existing = workloadByOwner.get(ownerId) ?? {
        id: ownerId,
        name: user?.displayName ?? 'Unassigned',
        initials: user ? initials(user.displayName) : '—',
        avatarUrl: user?.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
        total: 0,
        open: 0,
        completed: 0,
        overdue: 0,
      }
      existing.total += 1
      if (completed) existing.completed += 1
      else {
        existing.open += 1
        if (task.dueDate && task.dueDate < today) existing.overdue += 1
      }
      workloadByOwner.set(ownerId, existing)
    }
    const workload = [...workloadByOwner.values()]
      .sort((left, right) => right.open - left.open || right.total - left.total || left.name.localeCompare(right.name))
      .slice(0, 6)

    const health = blocked.length || overdue.length ? 'At risk' : tasks.length > 0 && completedTasks.length === tasks.length ? 'Completed' : 'On track'
    return {
      project: { id: scope.project.project._id, name: scope.project.project.name, description: scope.project.project.description ?? null, status: scope.project.project.status ?? 'active', updatedAt: scope.project.project.updatedAt, health },
      members: memberSummaries.filter((member): member is NonNullable<typeof member> => Boolean(member)),
      memberCount: members.length,
      permissions: { canManageProject: scope.project.capabilities.canManageProject, canWriteProject: scope.project.capabilities.canWriteProject },
      stats,
      trend,
      trendSummary: { completedThisMonth, completedLastMonth },
      distribution,
      workload,
      attentionCount: attention.length,
      attention: attention.slice(0, 5),
      yourWork: activity.filter((entry) => entry.actorId === String(actor.userId)).slice(0, 4),
      recentWork: activity.slice(0, 4),
      latestThread: visibleThreads[0] ? { id: visibleThreads[0]._id, groupId: visibleThreads[0].groupId } : null,
    }
  },
})

export const get = query({
  args: {
    companyId: v.id('companies'),
    days: v.optional(v.union(v.literal(7), v.literal(30), v.literal(90))),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireActiveCompanyMembership(ctx, actor, args.companyId)
    const rangeDays = args.days ?? 7

    const [actorProjectMemberships, relationshipRows] = await Promise.all([
      ctx.db.query('projectMembers').withIndex('by_user', (q) => q.eq('userId', actor.userId)).collect(),
      ctx.db.query('relationshipCompanies').withIndex('by_company_status', (q) => q.eq('companyId', company._id).eq('status', 'active')).collect(),
    ])

    const representedMemberships = actorProjectMemberships.filter((membership) =>
      membership.companyId === company._id && membership.status === 'active',
    )
    const membershipByProjectId = new Map(representedMemberships.map((membership) => [String(membership.projectId), membership]))
    if (args.projectId && !membershipByProjectId.has(String(args.projectId))) throw new Error('project_unavailable')
    const selectedProjectIds = [...new Map(
      representedMemberships
        .filter((membership) => !args.projectId || membership.projectId === args.projectId)
        .map((membership) => [String(membership.projectId), membership.projectId] as const),
    ).values()]
    const selectedProjects = (await Promise.all(selectedProjectIds.map((projectId) => ctx.db.get(projectId))))
      .filter((project): project is NonNullable<typeof project> => Boolean(project && project.status === 'active'))

    const perProject = await Promise.all(selectedProjects.map(async (project) => {
      const representedMembership = membershipByProjectId.get(String(project._id))!
      const [allTasks, members, workflowStates, taskActivities, allMessages, audits, groupMemberships] = await Promise.all([
        ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', project._id).eq('archivedAt', undefined)).collect(),
        ctx.db.query('projectMembers').withIndex('by_project_status', (q) => q.eq('projectId', project._id).eq('status', 'active')).collect(),
        Promise.all(['backlog', 'unstarted', 'started', 'completed', 'canceled'].map((category) => ctx.db.query('taskWorkflowStates').withIndex('by_project_category', (q) => q.eq('projectId', project._id).eq('category', category as 'backlog')).collect())).then((groups) => groups.flat()),
        ctx.db.query('taskActivities').withIndex('by_project_created_at', (q) => q.eq('projectId', project._id)).order('desc').take(100),
        ctx.db.query('messages').withIndex('by_project_created_at', (q) => q.eq('projectId', project._id)).order('desc').take(100),
        Promise.all(companyFeedAuditActions.map((action) => ctx.db.query('auditEvents')
          .withIndex('by_project_action_created_at', (q) => q.eq('projectId', project._id).eq('action', action))
          .order('desc')
          .take(5))).then((groups) => groups.flat().sort((left, right) => right.createdAt - left.createdAt).slice(0, 5)),
        ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) => q.eq('projectMemberId', representedMembership._id).eq('status', 'active')).collect(),
      ])
      const visibleGroupIds = new Set(groupMemberships.map((membership) => String(membership.groupId)))
      const canReadGroup = (groupId: Id<'groups'> | undefined) => !groupId || visibleGroupIds.has(String(groupId))
      const [visibleGroups, memberPreviews] = await Promise.all([
        Promise.all(groupMemberships.map((membership) => ctx.db.get(membership.groupId))).then((groups) =>
          groups.filter((group): group is NonNullable<typeof group> => Boolean(group && group.status === 'active')),
        ),
        Promise.all(members.slice(0, 4).map(async (member) => {
          const user = await ctx.db.get(member.userId)
          if (!user) return null
          return {
            id: user._id,
            name: user.displayName,
            avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
          }
        })).then((previews) => previews.filter((preview): preview is NonNullable<typeof preview> => Boolean(preview))),
      ])
      const tasks = allTasks.filter((task) => canReadGroup(task.groupId))
      const visibleTaskIds = new Set(tasks.map((task) => String(task._id)))
      const messages = allMessages.filter((message) => canReadGroup(message.groupId))
      const visibleTaskActivities = taskActivities.filter((activity) => visibleTaskIds.has(String(activity.taskId)) && canReadGroup(activity.originalGroupId))
      const visibleAudits = audits.filter((audit) => canReadGroup(audit.groupId))
      const stateById = new Map(workflowStates.map((state) => [state._id, state]))
      return { project, representedMembership, tasks, members, memberPreviews, visibleGroups, stateById, taskActivities: visibleTaskActivities, messages, audits: visibleAudits }
    }))

    const now = new Date()
    const today = new Date(startOfUtcDay(now)).toISOString().slice(0, 10)
    const dueThrough = addUtcDays(today, 7)
    const weekStart = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7))))
    const rangeStart = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - rangeDays + 1)))
    const distribution = { todo: 0, inProgress: 0, completed: 0, overdue: 0 }
    let openTasks = 0
    let overdueTasks = 0
    let completedThisWeek = 0
    let dailyTasks = 0
    let upcomingTasks = 0
    const assignedPeople = new Set<Id<'users'>>()
    const trendMap = new Map<string, { created: number; completed: number }>()
    for (let offset = 0; offset < rangeDays; offset += 1) {
      const date = new Date(rangeStart + offset * 86_400_000)
      trendMap.set(dayKey(date.getTime()), { created: 0, completed: 0 })
    }

    const projectRows = perProject.map(({ project, representedMembership, tasks, members, memberPreviews, visibleGroups, stateById }) => {
      let completed = 0
      let actionable = 0
      let overdue = 0
      let blocked = 0
      tasks.forEach((task) => {
        const state = stateById.get(task.workflowStateId)
        const category = state?.category ?? 'unstarted'
        const done = isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined)
        const terminal = done || category === 'canceled'
        if (!terminal) {
          if (task.assigneeProjectMemberId) {
            const assignee = members.find((member) => member._id === task.assigneeProjectMemberId)
            if (assignee) assignedPeople.add(assignee.userId)
          }
          openTasks += 1
          actionable += 1
          if (task.dueDate === today) dailyTasks += 1
          if (task.dueDate && task.dueDate > today && task.dueDate <= dueThrough) upcomingTasks += 1
          if (task.dueDate && task.dueDate < today) {
            overdueTasks += 1
            overdue += 1
          }
          if (task.dueDate && task.dueDate < today) {
            distribution.overdue += 1
          } else if (category === 'started') {
            distribution.inProgress += 1
          } else {
            distribution.todo += 1
          }
          if (state?.name.trim().toLocaleLowerCase() === 'blocked') blocked += 1
        } else if (done) {
          completed += 1
          distribution.completed += 1
          if (task.terminalAt && task.terminalAt >= weekStart) completedThisWeek += 1
        }
        const createdKey = dayKey(task.createdAt)
        const createdTrend = trendMap.get(createdKey)
        if (createdTrend) createdTrend.created += 1
        if (done && task.terminalAt && task.terminalAt >= rangeStart) {
          const completedTrend = trendMap.get(dayKey(task.terminalAt))
          if (completedTrend) completedTrend.completed += 1
        }
      })
      const progress = actionable + completed > 0 ? Math.round((completed / (actionable + completed)) * 100) : 0
      const health = overdue > 0 ? 'At risk' : progress === 100 && tasks.length > 0 ? 'Completed' : tasks.length === 0 ? 'Active' : 'On track'
      return {
        id: project._id,
        name: project.name,
        description: project.description ?? project.clientLabel ?? null,
        progress,
        completedTasks: completed,
        totalTasks: actionable + completed,
        overdueTasks: overdue,
        health,
        memberCount: members.length,
        members: memberPreviews,
        channelCount: visibleGroups.length,
        channels: visibleGroups.slice(0, 2).map((group) => ({ id: group._id, name: group.name })),
        companyId: company._id,
        membershipId: representedMembership._id,
        role: representedMembership.role,
      }
    })

    const userIds = new Set<Id<'users'>>()
    const memberById = new Map<string, { userId: Id<'users'> }>()
    for (const row of perProject) {
      for (const member of row.members) {
        userIds.add(member.userId)
        memberById.set(String(member._id), member)
      }
      for (const audit of row.audits) {
        if (audit.actorId) userIds.add(audit.actorId)
      }
    }
    const users = await Promise.all([...userIds].map((userId) => ctx.db.get(userId)))
    const userById = new Map(users.filter((user): user is NonNullable<typeof user> => Boolean(user)).map((user) => [String(user._id), user]))

    const workloadByOwner = new Map<string, { id: string; name: string; initials: string; total: number; open: number; completed: number; overdue: number }>()
    for (const row of perProject) {
      for (const task of row.tasks) {
        const state = row.stateById.get(task.workflowStateId)
        const category = state?.category ?? 'unstarted'
        if (category === 'canceled') continue
        const completed = isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined)
        const member = task.assigneeProjectMemberId ? memberById.get(String(task.assigneeProjectMemberId)) : null
        const user = member ? userById.get(String(member.userId)) : null
        const ownerId = member && user && task.assigneeProjectMemberId ? String(task.assigneeProjectMemberId) : 'unassigned'
        const existing = workloadByOwner.get(ownerId) ?? {
          id: ownerId,
          name: user?.displayName ?? 'Unassigned',
          initials: user ? initials(user.displayName) : '—',
          total: 0,
          open: 0,
          completed: 0,
          overdue: 0,
        }
        existing.total += 1
        if (completed) existing.completed += 1
        else {
          existing.open += 1
          if (task.dueDate && task.dueDate < today) existing.overdue += 1
        }
        workloadByOwner.set(ownerId, existing)
      }
    }
    const workload = [...workloadByOwner.values()]
      .sort((left, right) => right.open - left.open || right.total - left.total || left.name.localeCompare(right.name))
      .slice(0, 6)

    const attentionByProject = await Promise.all(perProject.map(async ({ project, tasks, members, stateById }) => {
      const userByMemberId = new Map(members.map((member) => [String(member._id), userById.get(String(member.userId))?.displayName ?? null]))
      const counts = { overdue: 0, blocked: 0, dueSoon: 0, unassigned: 0 }
      const items = tasks.flatMap((task) => {
        const state = stateById.get(task.workflowStateId)
        const category = state?.category ?? 'unstarted'
        const done = isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined)
        if (done || category === 'canceled') return []

        const isBlocked = state?.name.trim().toLocaleLowerCase() === 'blocked'
        const isOverdue = Boolean(task.dueDate && task.dueDate < today)
        const isDueSoon = Boolean(task.dueDate && task.dueDate >= today && task.dueDate <= dueThrough)
        const isUnassigned = !task.assigneeProjectMemberId
        if (isOverdue) counts.overdue += 1
        if (isBlocked) counts.blocked += 1
        if (isDueSoon) counts.dueSoon += 1
        if (isUnassigned) counts.unassigned += 1

        const categoryForItem = isBlocked ? 'blocked' : isOverdue ? 'overdue' : isDueSoon ? 'dueSoon' : isUnassigned ? 'unassigned' : null
        if (!categoryForItem) return []
        return [{
          id: task._id,
          taskKey: task.publicKey,
          projectId: project._id,
          projectName: project.name,
          title: task.title,
          status: state?.name ?? 'To do',
          category: categoryForItem,
          assignee: task.assigneeProjectMemberId ? userByMemberId.get(String(task.assigneeProjectMemberId)) ?? null : null,
          dueDate: task.dueDate ?? null,
        }]
      })
      return { counts, items }
    }))
    const attentionCounts = attentionByProject.reduce((totals, current) => ({
      overdue: totals.overdue + current.counts.overdue,
      blocked: totals.blocked + current.counts.blocked,
      dueSoon: totals.dueSoon + current.counts.dueSoon,
      unassigned: totals.unassigned + current.counts.unassigned,
    }), { overdue: 0, blocked: 0, dueSoon: 0, unassigned: 0 })
    const attention = attentionByProject.flatMap((current) => current.items)
      .sort((left, right) => {
        const priority: Record<string, number> = { blocked: 0, overdue: 1, dueSoon: 2, unassigned: 3 }
        return priority[left.category] - priority[right.category] || (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
      })
      .slice(0, 6)

    const taskHistory = perProject.flatMap(({ tasks, members, stateById }) => tasks.map((task) => ({
      assigneeUserId: task.assigneeProjectMemberId
        ? members.find((member) => member._id === task.assigneeProjectMemberId)?.userId
        : undefined,
      category: (() => {
        const state = stateById.get(task.workflowStateId)
        return isCompletedWorkflowState(state ? { category: state.category, stateName: state.name } : undefined) ? 'completed' : (state?.category ?? 'unstarted')
      })(),
      createdAt: task.createdAt,
      dueDate: task.dueDate,
      terminalAt: task.terminalAt,
    })))
    const statTrends = [...trendMap.keys()].map((date) => {
      const endOfDay = Date.parse(`${date}T23:59:59.999Z`)
      const openForDay = taskHistory.filter((task) =>
        task.createdAt <= endOfDay && (!task.terminalAt || task.terminalAt > endOfDay),
      )
      const completedForWeek = taskHistory.filter((task) =>
        task.category === 'completed' &&
        Boolean(task.terminalAt && task.terminalAt >= weekStart && task.terminalAt <= endOfDay),
      ).length
      return {
        date,
        openTasks: openForDay.length,
        overdueTasks: openForDay.filter((task) => Boolean(task.dueDate && task.dueDate < date)).length,
        completedThisWeek: completedForWeek,
        activePeople: new Set(openForDay.flatMap((task) => task.assigneeUserId ? [String(task.assigneeUserId)] : [])).size,
      }
    })

    type FeedItem = {
      id: string
      projectId: Id<'projects'>
      projectName: string
      actorName: string
      actorInitials: string
      action: string
      title: string
      preview: string
      createdAt: number
      kind: 'task' | 'message' | 'project'
      taskKey?: string
      groupId?: Id<'groups'>
      threadId?: Id<'channelThreads'>
    }
    const feed: FeedItem[] = []
    for (const row of perProject) {
      for (const activity of row.taskActivities) {
        const task = row.tasks.find((item) => item._id === activity.taskId)
        const member = activity.actorProjectMemberId ? memberById.get(String(activity.actorProjectMemberId)) : null
        const user = member ? userById.get(String(member.userId)) : null
        const actorName = user?.displayName ?? 'A teammate'
        feed.push({ id: String(activity._id), projectId: row.project._id, projectName: row.project.name, actorName, actorInitials: initials(actorName), action: actionLabel(activity.action), title: task?.title ?? 'Project task', preview: `${actorName} ${actionLabel(activity.action)} ${task?.title ?? 'a task'}.`, createdAt: activity.createdAt, kind: 'task', taskKey: task?.publicKey })
      }
      for (const message of row.messages) {
        const member = message.authorProjectMemberId ? memberById.get(String(message.authorProjectMemberId)) : null
        const user = member ? userById.get(String(member.userId)) : null
        const actorName = user?.displayName ?? 'A teammate'
        feed.push({ id: String(message._id), projectId: row.project._id, projectName: row.project.name, actorName, actorInitials: initials(actorName), action: 'commented', title: row.project.name, preview: message.body || message.notificationPreview || 'Added a project update.', createdAt: message.createdAt, kind: 'message', groupId: message.groupId, threadId: message.channelThreadId })
      }
      for (const audit of row.audits) {
        const actor = audit.actorId ? userById.get(String(audit.actorId)) : null
        const actorName = actor?.displayName ?? 'A teammate'
        const description = describeCompanyAuditActivity(audit.action, actorName, row.project.name)
        if (!description) continue
        feed.push({ id: String(audit._id), projectId: row.project._id, projectName: row.project.name, actorName, actorInitials: initials(actorName), action: description.action, title: row.project.name, preview: description.preview, createdAt: audit.createdAt, kind: 'project' })
      }
    }
    feed.sort((left, right) => right.createdAt - left.createdAt)

    const partnerRows = await Promise.all(relationshipRows.slice(0, 5).map(async (row) => {
      const relationship = await ctx.db.get(row.relationshipId)
      if (!relationship) return null
      const participantRows = await ctx.db.query('relationshipCompanies').withIndex('by_relationship_status', (q) => q.eq('relationshipId', row.relationshipId).eq('status', 'active')).collect()
      const partnerId = participantRows.find((participant) => participant.companyId !== company._id)?.companyId
      const partner = partnerId ? await ctx.db.get(partnerId) : null
      return partner ? { id: String(relationship._id), name: partner.displayName, relationshipName: relationship.name, status: row.status === 'active' ? 'Active' : row.status, initials: initials(partner.displayName) } : null
    }))

    return {
      company: { id: company._id, name: company.displayName },
      quote: dashboardQuotes[Math.floor(Date.now() / 86_400_000) % dashboardQuotes.length],
      stats: {
        openTasks,
        overdueTasks,
        completedThisWeek,
        dailyTasks,
        inProgressTasks: distribution.inProgress,
        completedTasks: distribution.completed,
        upcomingTasks,
        activePeople: assignedPeople.size,
        trends: statTrends,
      },
      projects: projectRows.sort((left, right) => right.overdueTasks - left.overdueTasks || right.progress - left.progress).slice(0, 5),
      taskDistribution: distribution,
      attentionCounts,
      attention,
      activityTrend: [...trendMap.entries()].map(([date, values]) => ({ date, ...values })),
      recentActivity: feed.slice(0, 5),
      workload,
      partners: partnerRows.filter((partner): partner is NonNullable<typeof partner> => Boolean(partner)).slice(0, 3),
    }
  },
})

/** Company-scoped task directory used by the Company Tasks screen. */
export const listTasks = query({
  args: {
    companyId: v.id('companies'),
    openOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const { company } = await requireActiveCompanyMembership(ctx, actor, args.companyId)
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', actor.userId))
      .collect()

    const projectMemberships = [...new Map(
      memberships
        .filter((membership) => membership.companyId === company._id && membership.status === 'active')
        .map((membership) => [String(membership.projectId), membership] as const),
    ).values()]

    const rows = (await Promise.all(projectMemberships.map(async (membership) => {
      const project = await ctx.db.get(membership.projectId)
      if (!project || project.status !== 'active') return []
      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_project_archived', (q) => q.eq('projectId', project._id).eq('archivedAt', undefined))
        .order('desc')
        .take(500)
      const visibleRows = []
      for (const task of tasks) {
        try {
          const access = await requireTaskAccess(ctx, actor, task._id, {
            actingCompanyId: company._id,
            projectMemberId: membership._id,
          })
          if (!access.taskCapabilities.canView) continue
          const [state, assignee] = await Promise.all([
            ctx.db.get(task.workflowStateId),
            task.assigneeProjectMemberId ? ctx.db.get(task.assigneeProjectMemberId) : null,
          ])
          if (!state || (args.openOnly && isTerminalTaskState(state.category))) continue
          visibleRows.push({
            task: {
              _id: task._id,
              publicKey: task.publicKey,
              title: task.title,
              dueDate: task.dueDate,
              priority: task.priority,
              updatedAt: task.updatedAt,
            },
            state: { name: state.name, category: state.category },
            assignee: assignee ? { userDisplayNameSnapshot: assignee.userDisplayNameSnapshot ?? null } : null,
            project: { _id: project._id, name: project.name },
            projectMemberId: membership._id,
          })
        } catch {
          // A revoked channel or project scope is omitted from the company directory.
        }
      }
      return visibleRows
    }))).flat()

    return rows.sort((left, right) => right.task.updatedAt - left.task.updatedAt).slice(0, 300)
  },
})
