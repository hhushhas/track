import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { ensureStandardWorkflow } from './taskBoards'

const companyHandle = 'track-role-demo'
const companyName = 'Northstar Labs'
const projectName = 'Website Redesign'

export const roleDemoUsers = [
  { key: 'olivia-owner', email: 'olivia.owner@track.local', name: 'Olivia Carter', designation: 'Company Owner', companyRole: 'owner' as const, projectRole: 'manager' as const },
  { key: 'daniel-admin', email: 'daniel.admin@track.local', name: 'Daniel Brooks', designation: 'Company Admin', companyRole: 'admin' as const, projectRole: 'member' as const },
  { key: 'maya-member', email: 'maya.member@track.local', name: 'Maya Patel', designation: 'Company Member', companyRole: 'member' as const, projectRole: 'member' as const },
  { key: 'ethan-project-owner', email: 'ethan.project-owner@track.local', name: 'Ethan Wilson', designation: 'Project Owner / Manager', companyRole: 'member' as const, projectRole: 'manager' as const },
  { key: 'sophia-project-member', email: 'sophia.project-member@track.local', name: 'Sophia Khan', designation: 'Project Member', companyRole: 'member' as const, projectRole: 'member' as const },
  { key: 'noah-channel-manager', email: 'noah.channel-manager@track.local', name: 'Noah Adams', designation: 'Channel Manager', companyRole: 'member' as const, projectRole: 'member' as const },
  { key: 'emma-channel-member', email: 'emma.channel-member@track.local', name: 'Emma Rodriguez', designation: 'Channel Member', companyRole: 'member' as const, projectRole: 'member' as const },
] as const

const channelNames = ['General', 'Design Discussion', 'Engineering', 'Launch Planning'] as const

async function authUser(ctx: MutationCtx, email: string) {
  const found = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: 'email', value: email }],
    select: ['_id', 'email', 'name'],
  }) as { _id?: string; email?: string; name?: string } | null
  const authId = found?._id
  if (!authId) throw new Error(`role_demo_auth_user_missing:${email}`)
  return { ...found, _id: authId }
}

async function trackUser(ctx: MutationCtx, userSpec: (typeof roleDemoUsers)[number]) {
  const auth = await authUser(ctx, userSpec.email)
  const existing = await ctx.db.query('users').withIndex('by_normalized_email', (q) => q.eq('normalizedEmail', userSpec.email)).unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, {
      authUserId: auth._id,
      googleSubject: auth._id,
      email: userSpec.email,
      normalizedEmail: userSpec.email,
      displayName: userSpec.name,
      profileDesignation: userSpec.designation,
      profileBio: `Demo account for testing the ${userSpec.designation.toLowerCase()} experience in Track.`,
      profileBannerStyle: 'paper',
      timezone: 'Asia/Karachi',
      profileCompletedAt: existing.profileCompletedAt ?? now,
      updatedAt: now,
    })
    return (await ctx.db.get(existing._id))!
  }
  const id = await ctx.db.insert('users', {
    authUserId: auth._id,
    googleSubject: auth._id,
    email: userSpec.email,
    normalizedEmail: userSpec.email,
    displayName: userSpec.name,
    profileDesignation: userSpec.designation,
    profileBio: `Demo account for testing the ${userSpec.designation.toLowerCase()} experience in Track.`,
    profileBannerStyle: 'paper',
    timezone: 'Asia/Karachi',
    profileCompletedAt: now,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  })
  return (await ctx.db.get(id))!
}

async function ensureCompanyMember(ctx: MutationCtx, companyId: Id<'companies'>, userId: Id<'users'>, role: 'owner' | 'admin' | 'member', name: string) {
  const existing = await ctx.db.query('companyMembers').withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', userId)).unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, { role, status: 'active', userDisplayNameSnapshot: name, companyDisplayNameSnapshot: companyName, updatedAt: now })
    return existing._id
  }
  return await ctx.db.insert('companyMembers', {
    companyId, userId, role, status: 'active', userDisplayNameSnapshot: name,
    companyDisplayNameSnapshot: companyName, createdAt: now, updatedAt: now,
  })
}

async function ensureProjectMember(ctx: MutationCtx, projectId: Id<'projects'>, companyId: Id<'companies'>, userId: Id<'users'>, role: 'manager' | 'member', name: string, projectCompanyId: Id<'projectCompanies'>) {
  const existing = await ctx.db.query('projectMembers').withIndex('by_project_company_user_term', (q) => q.eq('projectId', projectId).eq('companyId', companyId).eq('userId', userId)).first()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, { role, status: 'active', projectCompanyId, userDisplayNameSnapshot: name, companyDisplayNameSnapshot: companyName, updatedAt: now })
    return existing._id
  }
  return await ctx.db.insert('projectMembers', {
    projectId, companyId, projectCompanyId, userId, role, status: 'active', term: 1,
    invitedBy: userId, userDisplayNameSnapshot: name, companyDisplayNameSnapshot: companyName,
    createdAt: now, updatedAt: now,
  })
}

async function ensureChannelMember(ctx: MutationCtx, projectId: Id<'projects'>, groupId: Id<'groups'>, userId: Id<'users'>, projectMemberId: Id<'projectMembers'>, steward: boolean) {
  const existing = await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) => q.eq('groupId', groupId).eq('projectMemberId', projectMemberId)).unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, { status: 'active', isSteward: steward, updatedAt: now })
    return existing._id
  }
  return await ctx.db.insert('groupMembers', { projectId, groupId, userId, projectMemberId, status: 'active', isSteward: steward, createdAt: now, updatedAt: now })
}

export const seed = internalMutation({
  args: {},
  returns: v.object({
    companyId: v.id('companies'),
    projectId: v.id('projects'),
    users: v.number(),
    channels: v.number(),
    messages: v.number(),
    threads: v.number(),
    tasks: v.number(),
    notifications: v.number(),
    comments: v.number(),
    followedThreads: v.number(),
  }),
  handler: async (ctx) => {
    const users = []
    for (const spec of roleDemoUsers) users.push({ spec, user: await trackUser(ctx, spec) })
    const owner = users[0]!
    const now = Date.now()
    let company = await ctx.db.query('companies').withIndex('by_handle', (q) => q.eq('normalizedHandle', companyHandle)).unique()
    if (!company) {
      const companyId = await ctx.db.insert('companies', { displayName: companyName, normalizedHandle: companyHandle, status: 'active', revision: 1, createdBy: owner.user._id, createdAt: now, updatedAt: now })
      company = await ctx.db.get(companyId)
    }
    if (!company) throw new Error('role_demo_company_failed')
    for (const entry of users) await ensureCompanyMember(ctx, company._id, entry.user._id, entry.spec.companyRole, entry.spec.name)

    let project = (await ctx.db.query('projects').withIndex('by_proposing_company_status', (q) => q.eq('proposingCompanyId', company!._id).eq('status', 'active')).take(20)).find((item) => item.name === projectName)
    if (!project) {
      const projectId = await ctx.db.insert('projects', { name: projectName, description: 'A realistic shared workspace for testing communication, tasks, access, and evidence.', accessProfile: 'company', origin: 'single_company', status: 'active', proposingCompanyId: company._id, participantRevision: 1, revision: 1, createdBy: owner.user._id, createdAt: now, updatedAt: now })
      project = (await ctx.db.get(projectId)) ?? undefined
    }
    if (!project) throw new Error('role_demo_project_failed')
    let projectCompany = await ctx.db.query('projectCompanies').withIndex('by_project_company_term', (q) => q.eq('projectId', project!._id).eq('companyId', company!._id)).first()
    if (!projectCompany) {
      const projectCompanyId = await ctx.db.insert('projectCompanies', { projectId: project._id, companyId: company._id, term: 1, status: 'active', acceptedBy: owner.user._id, acceptedAt: now, createdAt: now, updatedAt: now })
      projectCompany = await ctx.db.get(projectCompanyId)
    }
    if (!projectCompany) throw new Error('role_demo_project_company_failed')

    const channels: Array<{ id: Id<'groups'>; name: string }> = []
    for (const [index, name] of channelNames.entries()) {
      let channel = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project!._id)).take(50)).find((item) => item.name === name)
      if (!channel) {
        const id = await ctx.db.insert('groups', { projectId: project._id, kind: index === 0 ? 'general' : 'custom', name, status: 'active', revision: 1, createdBy: owner.user._id, createdAt: now, updatedAt: now })
        channel = (await ctx.db.get(id)) ?? undefined
      }
      if (channel) channels.push({ id: channel._id, name: channel.name })
    }

    const projectMembers = new Map<string, Id<'projectMembers'>>()
    for (const entry of users) {
      const id = await ensureProjectMember(ctx, project._id, company._id, entry.user._id, entry.spec.projectRole, entry.spec.name, projectCompany._id)
      projectMembers.set(entry.spec.key, id)
      for (const channel of channels) await ensureChannelMember(ctx, project._id, channel.id, entry.user._id, id, entry.spec.key === 'noah-channel-manager' && channel.name === 'Design Discussion')
    }

    let board = await ctx.db.query('taskBoards').withIndex('by_project_archived', (q) => q.eq('projectId', project!._id).eq('archivedAt', undefined)).first()
    if (!board) {
      const boardId = await ctx.db.insert('taskBoards', { projectId: project._id, name: 'Website Redesign Board', description: 'Demo work board for role testing.', rank: '00000001', isDefault: true, createdByProjectMemberId: projectMembers.get(owner.spec.key)!, actingCompanyId: company._id, createdAt: now, updatedAt: now })
      board = await ctx.db.get(boardId)
    }
    if (!board) throw new Error('role_demo_board_failed')
    await ensureStandardWorkflow(ctx, project._id, board._id, now)
    const state = await ctx.db.query('taskWorkflowStates').withIndex('by_board_default', (q) => q.eq('boardId', board!._id).eq('isDefault', true)).first()
    if (!state) throw new Error('role_demo_state_failed')
    let label = await ctx.db.query('taskLabels').withIndex('by_project_name', (q) => q.eq('projectId', project!._id).eq('name', 'Role demo')).unique()
    if (!label) {
      const labelId = await ctx.db.insert('taskLabels', { projectId: project._id, name: 'Role demo', colorToken: 'violet', createdByProjectMemberId: projectMembers.get(owner.spec.key)!, createdAt: now, updatedAt: now })
      label = await ctx.db.get(labelId)
    }
    if (!label) throw new Error('role_demo_label_failed')

    for (const [index, entry] of users.entries()) {
      const memberId = projectMembers.get(entry.spec.key)!
      const collaborator = users[(index + 1) % users.length]!
      const collaboratorMemberId = projectMembers.get(collaborator.spec.key)!
      const channel = channels[index % channels.length]!
      const channelSequence = Math.floor(index / channels.length) * 2 + 1
      const key = `role-demo-message-${entry.spec.key}`
      let message = await ctx.db.query('messages').withIndex('by_author_idempotency', (q) => q.eq('authorProjectMemberId', memberId).eq('idempotencyKey', key)).unique()
      if (!message) {
        const messageId = await ctx.db.insert('messages', { projectId: project._id, groupId: channel.id, authorId: entry.user._id, authorProjectMemberId: memberId, actingCompanyId: company._id, channelSequence, idempotencyKey: key, body: `${entry.user.displayName} asks ${collaborator.user.displayName} to review the ${entry.spec.designation.toLowerCase()} workflow.`, mentions: [collaborator.user._id], mentionedProjectMemberIds: [collaboratorMemberId], attachmentIds: [], createdAt: now + index })
        message = await ctx.db.get(messageId)
      }
      if (!message) throw new Error('role_demo_message_failed')
      await ctx.db.patch(message._id, {
        body: `${entry.user.displayName} asks ${collaborator.user.displayName} to review the ${entry.spec.designation.toLowerCase()} workflow.`,
        channelSequence,
        createdAt: now + index,
        mentionedProjectMemberIds: [collaboratorMemberId],
        mentions: [collaborator.user._id],
      })
      const threadKey = `role-demo-thread-${entry.spec.key}`
      let thread = await ctx.db.query('channelThreads').withIndex('by_group_idempotency', (q) => q.eq('groupId', channel.id).eq('idempotencyKey', threadKey)).unique()
      if (!thread) {
        const threadId = await ctx.db.insert('channelThreads', { projectId: project._id, groupId: channel.id, name: `${entry.spec.designation} access check`, sourceMessageId: message._id, creatorUserId: entry.user._id, creatorProjectMemberId: memberId, actingCompanyId: company._id, status: 'active', revision: 1, replyCount: 1, latestChannelSequence: channelSequence + 1, idempotencyKey: threadKey, createdAt: now + index, updatedAt: now + index })
        await ctx.db.patch(message._id, { channelThreadId: threadId })
        await ctx.db.insert('messages', { projectId: project._id, groupId: channel.id, authorId: collaborator.user._id, authorProjectMemberId: collaboratorMemberId, actingCompanyId: company._id, channelThreadId: threadId, channelSequence: channelSequence + 1, idempotencyKey: `${threadKey}-reply`, replyToMessageId: message._id, body: `${collaborator.user.displayName} confirmed the handoff and kept the decision linked to its source.`, mentions: [entry.user._id], mentionedProjectMemberIds: [memberId], attachmentIds: [], createdAt: now + index + 1 })
        thread = await ctx.db.get(threadId)
      }
      if (!thread) throw new Error('role_demo_thread_failed')
      await ctx.db.patch(thread._id, { latestChannelSequence: channelSequence + 1, replyCount: 1, updatedAt: now + index + 1 })
      const reply = (await ctx.db.query('messages').withIndex('by_thread_created_at', (q) => q.eq('channelThreadId', thread!._id)).take(10))
        .find((candidate) => candidate.idempotencyKey === `${threadKey}-reply`)
      if (reply) await ctx.db.patch(reply._id, {
        authorId: collaborator.user._id,
        authorProjectMemberId: collaboratorMemberId,
        body: `${collaborator.user.displayName} confirmed the handoff and kept the decision linked to its source.`,
        channelSequence: channelSequence + 1,
        createdAt: now + index + 1,
        mentionedProjectMemberIds: [memberId],
        mentions: [entry.user._id],
        replyToMessageId: message._id,
      })
      const follower = await ctx.db.query('channelThreadFollowers').withIndex('by_thread_project_member', (q) =>
        q.eq('channelThreadId', thread!._id).eq('projectMemberId', collaboratorMemberId),
      ).unique()
      if (follower) await ctx.db.patch(follower._id, { preference: 'following', reason: 'replied', updatedAt: now + index + 1 })
      else await ctx.db.insert('channelThreadFollowers', {
        projectId: project._id, groupId: channel.id, channelThreadId: thread._id,
        userId: collaborator.user._id, projectMemberId: collaboratorMemberId,
        actingCompanyId: company._id, reason: 'replied', preference: 'following',
        createdAt: now + index + 1, updatedAt: now + index + 1,
      })
      const taskKey = `role-demo-task-${entry.spec.key}`
      let task = await ctx.db.query('tasks').withIndex('by_project_idempotency', (q) => q.eq('projectId', project!._id).eq('createIdempotencyKey', taskKey)).unique()
      if (!task) {
        const taskId = await ctx.db.insert('tasks', { projectId: project._id, publicKey: `TRK-DEMO-${String(index + 1).padStart(3, '0')}`, boardId: board._id, groupId: channel.id, workflowStateId: state._id, rank: String(index + 1).padStart(8, '0'), title: `Review ${entry.spec.designation.toLowerCase()} access`, description: `${collaborator.user.displayName} assigned this review to ${entry.user.displayName}.`, searchText: `${entry.spec.designation} access role demo`.toLowerCase(), assigneeProjectMemberId: memberId, priority: index % 2 === 0 ? 'medium' : 'high', createdByProjectMemberId: collaboratorMemberId, actingCompanyId: company._id, revision: 1, createIdempotencyKey: taskKey, createdAt: now + index, updatedAt: now + index })
        await ctx.db.insert('taskLabelLinks', { projectId: project._id, taskId, labelId: label._id, createdAt: now + index })
        await ctx.db.insert('taskReferences', { projectId: project._id, taskId, type: 'message', groupId: channel.id, channelThreadId: thread?._id, messageId: message._id, quote: message.body, availability: 'available', isPrimary: true, actorProjectMemberId: memberId, actingCompanyId: company._id, rank: '00000001', createdAt: now + index, updatedAt: now + index })
        await ctx.db.insert('taskFollowers', { projectId: project._id, taskId, userId: entry.user._id, projectMemberId: memberId, reason: 'assignee', enabled: true, createdAt: now + index, updatedAt: now + index })
        await ctx.db.insert('taskActivities', { projectId: project._id, taskId, actorProjectMemberId: collaboratorMemberId, actingCompanyId: company._id, action: 'created', correlationId: taskKey, createdAt: now + index })
        task = await ctx.db.get(taskId)
      }
      if (!task) throw new Error('role_demo_task_failed')
      await ctx.db.patch(task._id, {
        assigneeProjectMemberId: memberId,
        createdByProjectMemberId: collaboratorMemberId,
        description: `${collaborator.user.displayName} assigned this review to ${entry.user.displayName}.`,
      })
      const taskFollower = await ctx.db.query('taskFollowers').withIndex('by_task_member', (q) =>
        q.eq('taskId', task!._id).eq('projectMemberId', memberId),
      ).unique()
      if (taskFollower) await ctx.db.patch(taskFollower._id, { reason: 'assignee', enabled: true, updatedAt: now + index })
      const createdActivity = (await ctx.db.query('taskActivities').withIndex('by_task_created_at', (q) =>
        q.eq('taskId', task!._id),
      ).collect()).find((activity) => activity.correlationId === taskKey)
      if (createdActivity) await ctx.db.patch(createdActivity._id, { actorProjectMemberId: collaboratorMemberId })
      const notificationKey = `role-demo-assignment-${entry.spec.key}`
      const notification = await ctx.db.query('taskNotifications').withIndex('by_member_idempotency', (q) =>
        q.eq('recipientProjectMemberId', memberId).eq('idempotencyKey', notificationKey),
      ).unique()
      if (!notification) await ctx.db.insert('taskNotifications', {
        projectId: project._id, taskId: task._id, recipientProjectMemberId: memberId,
        recipientUserId: entry.user._id, originalGroupId: channel.id, eventType: 'assignment',
        payload: { actorName: collaborator.user.displayName }, idempotencyKey: notificationKey,
        createdAt: now + index + 2,
      })
      const commentKey = `role-demo-comment-${entry.spec.key}`
      const comment = await ctx.db.query('taskComments').withIndex('by_task_idempotency', (q) =>
        q.eq('taskId', task!._id).eq('idempotencyKey', commentKey),
      ).unique()
      if (!comment) await ctx.db.insert('taskComments', {
        projectId: project._id, taskId: task._id, originalGroupId: channel.id,
        authorProjectMemberId: collaboratorMemberId, actingCompanyId: company._id,
        body: `${collaborator.user.displayName} added acceptance context for ${entry.user.displayName}.`,
        mentionedProjectMemberIds: [memberId], revision: 1, idempotencyKey: commentKey,
        createdAt: now + index + 2, updatedAt: now + index + 2,
      })
    }
    for (const [index, channel] of channels.entries()) {
      const author = users[(index + 1) % users.length]!
      const authorMemberId = projectMembers.get(author.spec.key)!
      const latestSequence = (await ctx.db.query('messages').withIndex('by_group_channel_sequence', (q) => q.eq('groupId', channel.id)).order('desc').first())?.channelSequence ?? 0
      const announcementKey = `role-demo-channel-update-${index + 1}`
      let announcement = await ctx.db.query('messages').withIndex('by_author_idempotency', (q) =>
        q.eq('authorProjectMemberId', authorMemberId).eq('idempotencyKey', announcementKey),
      ).unique()
      if (!announcement) {
        const announcementId = await ctx.db.insert('messages', {
          projectId: project._id, groupId: channel.id, authorId: author.user._id,
          authorProjectMemberId: authorMemberId, actingCompanyId: company._id,
          channelSequence: latestSequence + 1, idempotencyKey: announcementKey,
          body: `${author.user.displayName} posted a fresh ${channel.name} update for the whole Project team.`,
          mentions: [], mentionedProjectMemberIds: [], attachmentIds: [], createdAt: now + 100 + index,
        })
        announcement = await ctx.db.get(announcementId)
      } else {
        await ctx.db.patch(announcement._id, {
          body: `${author.user.displayName} posted a fresh ${channel.name} update for the whole Project team.`,
          channelSequence: latestSequence + 1,
          createdAt: now + 100 + index,
        })
      }
      await ctx.db.patch(channel.id, { nextChannelSequence: latestSequence + 2, updatedAt: now })
    }
    const [allMessages, allThreads, allTasks, allNotifications] = await Promise.all([
      ctx.db.query('messages').withIndex('by_project_created_at', (q) => q.eq('projectId', project!._id)).take(500),
      ctx.db.query('channelThreads').withIndex('by_project', (q) => q.eq('projectId', project!._id)).take(100),
      ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', project!._id)).take(100),
      ctx.db.query('taskNotifications').withIndex('by_project', (q) => q.eq('projectId', project!._id)).take(100),
    ])
    let comments = 0
    let followedThreads = 0
    for (const task of allTasks) {
      comments += (await ctx.db.query('taskComments').withIndex('by_task_created_at', (q) => q.eq('taskId', task._id)).take(20)).length
    }
    for (const memberId of projectMembers.values()) {
      followedThreads += (await ctx.db.query('channelThreadFollowers').withIndex('by_project_member_preference', (q) =>
        q.eq('projectMemberId', memberId).eq('preference', 'following'),
      ).take(100)).length
    }
    return {
      companyId: company._id,
      projectId: project._id,
      users: users.length,
      channels: channels.length,
      messages: allMessages.length,
      threads: allThreads.length,
      tasks: allTasks.length,
      notifications: allNotifications.length,
      comments,
      followedThreads,
    }
  },
})
