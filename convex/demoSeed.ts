import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { components } from './_generated/api'

const demoCompanyHandle = 'track-demo'
const demoProjectName = 'Track Product Launch'

const workflow = [
  { name: 'Backlog', category: 'backlog' as const, visualToken: 'slate' },
  { name: 'Ready', category: 'unstarted' as const, visualToken: 'blue' },
  { name: 'In progress', category: 'started' as const, visualToken: 'amber' },
  { name: 'Done', category: 'completed' as const, visualToken: 'green' },
]

const supplementalProjects = [
  {
    name: 'Customer Onboarding',
    description: 'Coordinate the customer launch and rollout experience.',
    channels: ['General', 'Customer feedback', 'Launch checklist'],
    tasks: [
      ['Confirm onboarding owner', 'Assign the person responsible for the first-week experience.', 'high'],
      ['Review welcome message', 'Incorporate feedback from the pilot customer group.', 'medium'],
      ['Publish onboarding checklist', 'Make the handoff steps visible to the whole team.', 'low'],
    ] as const,
  },
  {
    name: 'Product Discovery',
    description: 'Capture research, decisions, and product opportunities.',
    channels: ['General', 'Research notes', 'Design critique'],
    tasks: [
      ['Cluster interview insights', 'Group the recurring themes from recent conversations.', 'medium'],
      ['Draft navigation proposal', 'Turn the strongest discovery findings into a testable flow.', 'high'],
      ['Schedule usability review', 'Prepare the next prototype review with the product team.', 'low'],
    ] as const,
  },
] as const

const scaleProjectNames = [
  'Engineering',
  'Customer Success',
  'Marketing',
  'Sales Operations',
  'People & Culture',
  'Finance',
  'Product',
  'Design Studio',
  'Support',
  'Operations',
] as const

const scaleChannelNames = ['General', 'Announcements', 'Team updates', 'Planning'] as const

async function findOrProvisionUser(ctx: MutationCtx, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  let user = await ctx.db
    .query('users')
    .withIndex('by_normalized_email', (q) => q.eq('normalizedEmail', normalizedEmail))
    .unique()
  if (!user) {
    const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', value: normalizedEmail }],
      select: ['_id', 'email', 'name'],
    }) as { _id?: string; email?: string; name?: string } | null
    if (!authUser?._id) throw new Error(`demo_auth_user_not_found:${normalizedEmail}`)
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      googleSubject: authUser._id,
      authUserId: authUser._id,
      normalizedEmail,
      email: authUser.email ?? normalizedEmail,
      displayName: authUser.name?.trim() || 'Track Developer',
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
    user = await ctx.db.get(userId)
    if (!user) throw new Error('demo_track_user_provision_failed')
  }
  return user
}

async function ensureSupplementalProject(
  ctx: MutationCtx,
  user: NonNullable<Awaited<ReturnType<typeof findOrProvisionUser>>>,
  input: (typeof supplementalProjects)[number],
) {
  const existing = (await ctx.db
    .query('projects')
    .withIndex('by_created_by', (q) => q.eq('createdBy', user._id))
    .take(100)).find((project) => project.name === input.name)
  if (existing) return

  const now = Date.now()
  const projectId = await ctx.db.insert('projects', {
    name: input.name,
    description: input.description,
    accessProfile: 'legacy',
    origin: 'single_company',
    status: 'active',
    participantRevision: 1,
    revision: 1,
    createdBy: user._id,
    createdAt: now,
    updatedAt: now,
  })
  const projectMemberId = await ctx.db.insert('projectMembers', {
    projectId,
    userId: user._id,
    role: 'owner',
    status: 'active',
    term: 1,
    invitedBy: user._id,
    userDisplayNameSnapshot: user.displayName,
    createdAt: now,
    updatedAt: now,
  })
  const groupIds: Array<Id<'groups'>> = []
  for (const [index, name] of input.channels.entries()) {
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: index === 0 ? 'general' : 'custom',
      name,
      status: 'active',
      revision: 1,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    })
    groupIds.push(groupId)
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: user._id,
      projectMemberId,
      status: 'active',
      isSteward: index === 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  const boardId = await ctx.db.insert('taskBoards', {
    projectId,
    name: `${input.name} board`,
    description: `Tasks for ${input.name.toLowerCase()}.`,
    rank: '00000001',
    isDefault: true,
    createdByProjectMemberId: projectMemberId,
    createdAt: now,
    updatedAt: now,
  })
  const stateIds: Array<Id<'taskWorkflowStates'>> = []
  for (const [index, state] of workflow.entries()) {
    stateIds.push(await ctx.db.insert('taskWorkflowStates', {
      projectId,
      boardId,
      name: state.name,
      category: state.category,
      visualToken: state.visualToken,
      rank: String(index + 1).padStart(4, '0'),
      isDefault: state.category === 'unstarted',
      createdAt: now,
      updatedAt: now,
    }))
  }
  const labelId = await ctx.db.insert('taskLabels', {
    projectId,
    name: 'Demo',
    colorToken: 'violet',
    createdByProjectMemberId: projectMemberId,
    createdAt: now,
    updatedAt: now,
  })

  const sourceMessageId = await ctx.db.insert('messages', {
    projectId,
    groupId: groupIds[1]!,
    authorId: user._id,
    authorProjectMemberId: projectMemberId,
    channelSequence: 1,
    body: `Welcome to ${input.name}. Share updates and decisions here so the work stays connected.`,
    mentions: [],
    attachmentIds: [],
    createdAt: now,
  })
  const threadId = await ctx.db.insert('channelThreads', {
    projectId,
    groupId: groupIds[1]!,
    name: `${input.name} weekly update`,
    sourceMessageId,
    creatorUserId: user._id,
    creatorProjectMemberId: projectMemberId,
    status: 'active',
    revision: 1,
    replyCount: 2,
    latestChannelSequence: 3,
    idempotencyKey: `demo-seed-${input.name.toLowerCase().replaceAll(' ', '-')}-thread`,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(sourceMessageId, { channelThreadId: threadId })
  for (const [index, body] of [
    'I have added the latest context and next steps.',
    'The open questions are ready for review in the task board.',
  ].entries()) {
    await ctx.db.insert('messages', {
      projectId,
      groupId: groupIds[1]!,
      authorId: user._id,
      authorProjectMemberId: projectMemberId,
      channelThreadId: threadId,
      channelSequence: index + 2,
      body,
      mentions: [],
      attachmentIds: [],
      createdAt: now + index + 1,
    })
  }

  for (const [index, [title, description, priority]] of input.tasks.entries()) {
    const taskId = await ctx.db.insert('tasks', {
      projectId,
      publicKey: `TRK-${input.name.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      boardId,
      groupId: groupIds[index + 1] ?? groupIds[1]!,
      workflowStateId: stateIds[index + 1] ?? stateIds[0]!,
      rank: String(index + 1).padStart(8, '0'),
      title,
      description,
      searchText: `${title} ${description}`.toLowerCase(),
      assigneeProjectMemberId: projectMemberId,
      priority,
      createdByProjectMemberId: projectMemberId,
      revision: 1,
      createIdempotencyKey: `demo-seed-${input.name.toLowerCase().replaceAll(' ', '-')}-task-${index + 1}`,
      createdAt: now + index,
      updatedAt: now + index,
    })
    await ctx.db.insert('taskLabelLinks', { projectId, taskId, labelId, createdAt: now + index })
    await ctx.db.insert('taskReferences', {
      projectId,
      taskId,
      type: 'message',
      groupId: groupIds[1]!,
      channelThreadId: threadId,
      messageId: sourceMessageId,
      availability: 'available',
      isPrimary: true,
      actorProjectMemberId: projectMemberId,
      rank: '00000001',
      createdAt: now + index,
      updatedAt: now + index,
    })
    await ctx.db.insert('taskFollowers', {
      projectId,
      taskId,
      userId: user._id,
      projectMemberId,
      reason: 'creator',
      enabled: true,
      createdAt: now + index,
      updatedAt: now + index,
    })
    await ctx.db.insert('taskActivities', {
      projectId,
      taskId,
      actorProjectMemberId: projectMemberId,
      action: 'created',
      correlationId: `demo-seed-${input.name.toLowerCase().replaceAll(' ', '-')}-task-${index + 1}`,
      createdAt: now + index,
    })
  }
}

async function ensureSupplementalProjects(
  ctx: MutationCtx,
  user: NonNullable<Awaited<ReturnType<typeof findOrProvisionUser>>>,
) {
  for (const project of supplementalProjects) {
    await ensureSupplementalProject(ctx, user, project)
  }
}

async function ensureScaleProjects(ctx: MutationCtx, userId: Id<'users'>) {
  const projects: Array<{
    projectId: Id<'projects'>
    groupIds: Array<Id<'groups'>>
    boardId: Id<'taskBoards'>
    stateIds: Array<Id<'taskWorkflowStates'>>
    labelId: Id<'taskLabels'>
  }> = []

  for (const projectName of scaleProjectNames) {
    const existing = (await ctx.db
      .query('projects')
      .withIndex('by_created_by', (q) => q.eq('createdBy', userId))
      .take(100)).find((project) => project.name === `Track ${projectName}`)
    const projectId = existing?._id ?? await ctx.db.insert('projects', {
      name: `Track ${projectName}`,
      description: `Synthetic company-scale workspace for ${projectName.toLowerCase()}.`,
      accessProfile: 'legacy',
      origin: 'single_company',
      status: 'active',
      participantRevision: 1,
      revision: 1,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const groupIds: Array<Id<'groups'>> = []
    for (const channelName of scaleChannelNames) {
      const existingGroup = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', projectId)).take(20))
        .find((group) => group.name === channelName)
      groupIds.push(existingGroup?._id ?? await ctx.db.insert('groups', {
        projectId,
        kind: channelName === 'General' ? 'general' : 'custom',
        name: channelName,
        status: 'active',
        revision: 1,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
    }
    const existingBoard = await ctx.db.query('taskBoards')
      .withIndex('by_project_archived', (q) => q.eq('projectId', projectId).eq('archivedAt', undefined))
      .first()
    const boardId = existingBoard?._id ?? await ctx.db.insert('taskBoards', {
      projectId,
      name: `${projectName} board`,
      description: `Shared work queue for the ${projectName.toLowerCase()} team.`,
      rank: '00000001',
      isDefault: true,
      createdByProjectMemberId: await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role: 'owner',
        status: 'active',
        term: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const boardOwner = existingBoard
      ? await ctx.db.query('projectMembers').withIndex('by_project_user', (q) => q.eq('projectId', projectId).eq('userId', userId)).unique()
      : null
    const stateRows = await ctx.db.query('taskWorkflowStates').withIndex('by_board_rank', (q) => q.eq('boardId', boardId)).take(20)
    const stateIds = stateRows.length > 0 ? stateRows.sort((a, b) => a.rank.localeCompare(b.rank)).map((state) => state._id) : []
    if (stateIds.length === 0) {
      for (const [index, state] of workflow.entries()) stateIds.push(await ctx.db.insert('taskWorkflowStates', {
        projectId, boardId, name: state.name, category: state.category, visualToken: state.visualToken,
        rank: String(index + 1).padStart(4, '0'), isDefault: state.category === 'unstarted',
        createdAt: Date.now(), updatedAt: Date.now(),
      }))
    }
    const existingLabel = await ctx.db.query('taskLabels').withIndex('by_project_name', (q) => q.eq('projectId', projectId).eq('name', 'Company scale')).unique()
    const labelId = existingLabel?._id ?? await ctx.db.insert('taskLabels', {
      projectId, name: 'Company scale', colorToken: 'blue',
      createdByProjectMemberId: boardOwner?._id ?? (await ctx.db.query('projectMembers').withIndex('by_project_user', (q) => q.eq('projectId', projectId).eq('userId', userId)).unique())!._id,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    projects.push({ projectId, groupIds, boardId, stateIds, labelId })
  }
  return projects
}

export const seedScaleBatch = internalMutation({
  args: { start: v.number(), count: v.number() },
  returns: v.object({ createdUsers: v.number(), createdMessages: v.number(), createdTasks: v.number() }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.start) || !Number.isInteger(args.count) || args.start < 0 || args.count < 1 || args.count > 100) {
      throw new Error('invalid_seed_batch')
    }
    const anchor = await findOrProvisionUser(ctx, 'developer@track.local')
    const projects = await ensureScaleProjects(ctx, anchor._id)
    let createdUsers = 0
    let createdMessages = 0
    let createdTasks = 0

    for (let offset = 0; offset < args.count; offset += 1) {
      const index = args.start + offset
      const email = `person-${String(index + 1).padStart(4, '0')}@track.local`
      let user = await ctx.db.query('users').withIndex('by_normalized_email', (q) => q.eq('normalizedEmail', email)).unique()
      if (!user) {
        const now = Date.now() + index
        const userId = await ctx.db.insert('users', {
          authUserId: `scale-auth-${index + 1}`,
          googleSubject: `scale-auth-${index + 1}`,
          normalizedEmail: email,
          email,
          displayName: `Track teammate ${index + 1}`,
          profileDesignation: ['Product manager', 'Engineer', 'Designer', 'Customer partner'][index % 4],
          timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Karachi'][index % 4],
          twoFactorEnabled: false,
          createdAt: now,
          updatedAt: now,
        })
        user = await ctx.db.get(userId)
        createdUsers += 1
      }
      if (!user) throw new Error('scale_user_create_failed')
      const project = projects[index % projects.length]!
      let projectMember = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', project.projectId).eq('userId', user!._id),
      ).unique()
      if (!projectMember) {
        const projectMemberId = await ctx.db.insert('projectMembers', {
          projectId: project.projectId, userId: user._id, role: index % 10 === 0 ? 'admin' : 'staff', status: 'active', term: 1,
          invitedBy: anchor._id, userDisplayNameSnapshot: user.displayName,
          createdAt: Date.now(), updatedAt: Date.now(),
        })
        projectMember = await ctx.db.get(projectMemberId)
        for (const groupId of project.groupIds) {
          const member = await ctx.db.query('groupMembers').withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', user!._id)).unique()
          if (!member) await ctx.db.insert('groupMembers', {
            projectId: project.projectId, groupId, userId: user._id, projectMemberId: projectMemberId,
            status: 'active', isSteward: false, createdAt: Date.now(), updatedAt: Date.now(),
          })
        }
      }
      if (!projectMember) throw new Error('scale_membership_create_failed')
      const groupId = project.groupIds[index % project.groupIds.length]!
      const messageKey = `scale-message-${index + 1}`
      const existingMessage = await ctx.db.query('messages').withIndex('by_author_idempotency', (q) =>
        q.eq('authorProjectMemberId', projectMember!._id).eq('idempotencyKey', messageKey),
      ).unique()
      const messageId = existingMessage?._id ?? await ctx.db.insert('messages', {
        projectId: project.projectId, groupId, authorId: user._id, authorProjectMemberId: projectMember._id,
        idempotencyKey: messageKey, body: [`Status update: the weekly plan is on track.`, `New customer feedback is ready for review.`, `I have shared the latest handoff notes.`, `The team is aligned on the next milestone.`][index % 4],
        mentions: [], attachmentIds: [], createdAt: Date.now() + index,
      })
      if (!existingMessage) createdMessages += 1
      const taskKey = `scale-task-${index + 1}`
      const existingTask = await ctx.db.query('tasks').withIndex('by_project_idempotency', (q) =>
        q.eq('projectId', project.projectId).eq('createIdempotencyKey', taskKey),
      ).unique()
      if (!existingTask) {
        const taskId = await ctx.db.insert('tasks', {
          projectId: project.projectId, publicKey: `TRK-${String(index + 1).padStart(5, '0')}`, boardId: project.boardId,
          groupId, workflowStateId: project.stateIds[index % project.stateIds.length]!, rank: String(index + 1).padStart(8, '0'),
          title: [`Review weekly update`, `Follow up on customer feedback`, `Prepare team handoff`, `Confirm next milestone`][index % 4],
          description: `Synthetic task ${index + 1} for company-scale workspace testing.`, searchText: `synthetic task ${index + 1}`,
          assigneeProjectMemberId: projectMember._id, priority: (['low', 'medium', 'high', 'urgent'] as const)[index % 4]!,
          createdByProjectMemberId: projectMember._id, revision: 1, createIdempotencyKey: taskKey,
          createdAt: Date.now() + index, updatedAt: Date.now() + index,
        })
        await ctx.db.insert('taskLabelLinks', { projectId: project.projectId, taskId, labelId: project.labelId, createdAt: Date.now() + index })
        await ctx.db.insert('taskReferences', {
          projectId: project.projectId, taskId, type: 'message', groupId, messageId,
          availability: 'available', isPrimary: true, actorProjectMemberId: projectMember._id,
          rank: '00000001', createdAt: Date.now() + index, updatedAt: Date.now() + index,
        })
        await ctx.db.insert('taskFollowers', {
          projectId: project.projectId, taskId, userId: user._id, projectMemberId: projectMember._id,
          reason: 'creator', enabled: true, createdAt: Date.now() + index, updatedAt: Date.now() + index,
        })
        await ctx.db.insert('taskActivities', {
          projectId: project.projectId, taskId, actorProjectMemberId: projectMember._id, action: 'created',
          correlationId: taskKey, createdAt: Date.now() + index,
        })
        createdTasks += 1
      }
    }
    return { createdUsers, createdMessages, createdTasks }
  },
})

async function seedForUser(ctx: MutationCtx, email: string) {
  const user = await findOrProvisionUser(ctx, email)

  const existingCompany = await ctx.db
    .query('companies')
    .withIndex('by_handle', (q) => q.eq('normalizedHandle', demoCompanyHandle))
    .unique()
  if (existingCompany) {
    const projects = await ctx.db.query('projects').withIndex('by_created_by', (q) => q.eq('createdBy', user._id)).take(100)
    const existingProject = projects.find((project) => project.name === demoProjectName)
    if (existingProject) {
      // The demo workspace is consumed by the legacy web and mobile workspace
      // surfaces. Repair older demo data that was seeded as a company project.
      if (existingProject.accessProfile !== 'legacy') {
        await ctx.db.patch(existingProject._id, {
          accessProfile: 'legacy',
        })
      }
      const existingProjectMember = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_user', (q) =>
          q.eq('projectId', existingProject._id).eq('userId', user._id),
        )
        .unique()
      if (existingProjectMember && existingProjectMember.role === 'manager') {
        await ctx.db.patch(existingProjectMember._id, { role: 'owner' })
      }
      await ensureSupplementalProjects(ctx, user)
      const tasks = await ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', existingProject._id)).take(100)
      return { seeded: false, companyId: existingCompany._id, projectId: existingProject._id, taskCount: tasks.length }
    }
  }

  const now = Date.now()
  const companyId = existingCompany?._id ?? await ctx.db.insert('companies', {
    displayName: 'Track Demo Company', normalizedHandle: demoCompanyHandle, status: 'active', revision: 1,
    createdBy: user._id, createdAt: now, updatedAt: now,
  })
  const companyMember = await ctx.db.query('companyMembers').withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', user._id)).unique()
  if (!companyMember) await ctx.db.insert('companyMembers', {
    companyId, userId: user._id, role: 'owner', status: 'active', userDisplayNameSnapshot: user.displayName,
    companyDisplayNameSnapshot: 'Track Demo Company', createdAt: now, updatedAt: now,
  })

  const projectId = await ctx.db.insert('projects', {
    name: demoProjectName, clientLabel: 'Internal launch workspace',
    description: 'A complete seeded workflow for exploring Track on mobile and web.',
    accessProfile: 'legacy', origin: 'single_company', status: 'active',
    participantRevision: 1, revision: 1, createdBy: user._id, createdAt: now, updatedAt: now,
  })
  await ctx.db.insert('projectCompanies', {
    projectId, companyId, term: 1, status: 'active', acceptedBy: user._id, acceptedAt: now,
    createdAt: now, updatedAt: now,
  })
  const projectMemberId = await ctx.db.insert('projectMembers', {
    projectId, userId: user._id, role: 'owner', status: 'active', term: 1,
    invitedBy: user._id, userDisplayNameSnapshot: user.displayName,
    createdAt: now, updatedAt: now,
  })

  const channelIds: Array<Id<'groups'>> = []
  for (const [index, name] of ['General', 'Launch planning', 'Design review'].entries()) {
    const groupId = await ctx.db.insert('groups', {
      projectId, kind: index === 0 ? 'general' : 'custom', name, status: 'active', revision: 1,
      createdBy: user._id, createdAt: now, updatedAt: now,
    })
    channelIds.push(groupId)
    await ctx.db.insert('groupMembers', {
      projectId, groupId, userId: user._id, projectMemberId, status: 'active', isSteward: index === 0,
      createdAt: now, updatedAt: now,
    })
  }

  const boardId = await ctx.db.insert('taskBoards', {
    projectId, name: 'Launch board', description: 'Seeded product-launch workflow', rank: '00000001', isDefault: true,
    createdByProjectMemberId: projectMemberId, actingCompanyId: companyId, createdAt: now, updatedAt: now,
  })
  const stateIds: Array<Id<'taskWorkflowStates'>> = []
  for (const [index, state] of workflow.entries()) stateIds.push(await ctx.db.insert('taskWorkflowStates', {
    projectId, boardId, name: state.name, category: state.category, visualToken: state.visualToken,
    rank: String(index + 1).padStart(4, '0'), isDefault: state.category === 'unstarted', createdAt: now, updatedAt: now,
  }))

  const labelIds = new Map<string, Id<'taskLabels'>>()
  for (const [name, colorToken] of [['Launch', 'violet'], ['Design', 'pink'], ['Engineering', 'blue']] as const) {
    labelIds.set(name, await ctx.db.insert('taskLabels', { projectId, name, colorToken, createdByProjectMemberId: projectMemberId, createdAt: now, updatedAt: now }))
  }

  const taskInputs = [
    ['Confirm launch scope', 'Agree on the v1 launch checklist and owners.', 1, 'high', 'Launch'],
    ['Polish mobile task board', 'Review loading, empty, and error states on iOS.', 2, 'medium', 'Design'],
    ['Validate Convex development environment', 'Confirm auth, data, and mobile configuration use the same deployment.', 2, 'urgent', 'Engineering'],
    ['Prepare launch notes', 'Write the internal release summary and testing instructions.', 0, 'low', 'Launch'],
  ] as const
  for (const [index, [title, description, stateIndex, priority, label]] of taskInputs.entries()) {
    const taskId = await ctx.db.insert('tasks', {
      projectId, publicKey: `TRK-${String(index + 1).padStart(3, '0')}`, boardId,
      workflowStateId: stateIds[stateIndex]!, rank: String(index + 1).padStart(8, '0'), title, description,
      searchText: `${title} ${description}`.toLowerCase(), assigneeProjectMemberId: projectMemberId,
      priority, dueDate: `2026-09-${String(10 + index).padStart(2, '0')}`, createdByProjectMemberId: projectMemberId,
      actingCompanyId: companyId, revision: 1, createIdempotencyKey: `demo-seed-task-${index + 1}`,
      createdAt: now + index, updatedAt: now + index,
    })
    await ctx.db.insert('taskLabelLinks', { projectId, taskId, labelId: labelIds.get(label)!, createdAt: now + index })
    await ctx.db.insert('taskFollowers', { projectId, taskId, userId: user._id, projectMemberId, reason: 'creator', enabled: true, createdAt: now + index, updatedAt: now + index })
    await ctx.db.insert('taskActivities', { projectId, taskId, actorProjectMemberId: projectMemberId, actingCompanyId: companyId, action: 'created', correlationId: `demo-seed-task-${index + 1}`, createdAt: now + index })
  }

  const messageId = await ctx.db.insert('messages', {
    projectId, groupId: channelIds[1]!, authorId: user._id, authorProjectMemberId: projectMemberId,
    actingCompanyId: companyId, channelSequence: 1,
    body: 'Welcome to the seeded Track launch workspace. Use this channel to coordinate the rollout.',
    mentions: [], attachmentIds: [], createdAt: now,
  })
  const threadId = await ctx.db.insert('channelThreads', {
    projectId, groupId: channelIds[1]!, name: 'Launch readiness checklist', sourceMessageId: messageId,
    creatorUserId: user._id, creatorProjectMemberId: projectMemberId, actingCompanyId: companyId, status: 'active',
    revision: 1, replyCount: 0, latestChannelSequence: 1, idempotencyKey: 'demo-seed-launch-readiness-thread',
    createdAt: now, updatedAt: now,
  })
  await ctx.db.patch(messageId, { channelThreadId: threadId })
  await ensureSupplementalProjects(ctx, user)

  return { seeded: true, companyId, projectId, taskCount: taskInputs.length }
}

export const seed = internalMutation({
  args: { email: v.string() },
  returns: v.object({ seeded: v.boolean(), companyId: v.id('companies'), projectId: v.id('projects'), taskCount: v.number() }),
  handler: async (ctx, args) => await seedForUser(ctx, args.email),
})

export const addManager = internalMutation({
  args: { email: v.string() },
  returns: v.object({ added: v.boolean(), companyId: v.id('companies'), projectId: v.id('projects') }),
  handler: async (ctx, args) => {
    const manager = await findOrProvisionUser(ctx, args.email)
    const company = await ctx.db.query('companies').withIndex('by_handle', (q) => q.eq('normalizedHandle', demoCompanyHandle)).unique()
    if (!company) throw new Error('demo_company_not_found')
    const projectCompanies = await ctx.db.query('projectCompanies').withIndex('by_company_status', (q) => q.eq('companyId', company._id).eq('status', 'active')).take(20)
    const project = (await Promise.all(projectCompanies.map((membership) => ctx.db.get(membership.projectId)))).find((item) => item?.name === demoProjectName)
    if (!project) throw new Error('demo_project_not_found')
    const now = Date.now()
    const companyMember = await ctx.db.query('companyMembers').withIndex('by_company_user', (q) => q.eq('companyId', company._id).eq('userId', manager._id)).unique()
    if (!companyMember) await ctx.db.insert('companyMembers', {
      companyId: company._id, userId: manager._id, role: 'member', status: 'active',
      userDisplayNameSnapshot: manager.displayName, companyDisplayNameSnapshot: company.displayName,
      createdAt: now, updatedAt: now,
    })
    const existingProjectMember = (await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', project._id)).take(100)).find((item) => item.userId === manager._id)
    const projectMemberId = existingProjectMember?._id ?? await ctx.db.insert('projectMembers', {
      projectId: project._id, companyId: company._id, userId: manager._id, role: 'staff', status: 'active', term: 1,
      invitedBy: manager._id, userDisplayNameSnapshot: manager.displayName, companyDisplayNameSnapshot: company.displayName,
      createdAt: now, updatedAt: now,
    })
    const groups = await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).take(20)
    for (const group of groups) {
      const membership = await ctx.db.query('groupMembers').withIndex('by_group_user', (q) => q.eq('groupId', group._id).eq('userId', manager._id)).unique()
      if (!membership) await ctx.db.insert('groupMembers', {
        projectId: project._id, groupId: group._id, userId: manager._id, projectMemberId, status: 'active',
        isSteward: false, createdAt: now, updatedAt: now,
      })
    }
    return { added: !existingProjectMember, companyId: company._id, projectId: project._id }
  },
})
