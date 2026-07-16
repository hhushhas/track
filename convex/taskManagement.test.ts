import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  captureTaskExitStaging,
  materializeTaskArchiveSnapshots,
  removeTaskMemberFromScope,
} from './lib/taskLifecycle'
import schema from './schema'

const modules = (
  import.meta as ImportMeta & {
    glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
  }
).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

const originalTasksFlag = process.env.TRACK_TASKS_ENABLED

beforeEach(() => {
  process.env.TRACK_TASKS_ENABLED = 'true'
})

afterEach(() => {
  process.env.TRACK_TASKS_ENABLED = originalTasksFlag
})

describe('task management authorization and invariants', () => {
  it('fails task access closed without affecting standalone conversation reads', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    process.env.TRACK_TASKS_ENABLED = 'false'
    await expect(
      owner.query(api.taskBoards.list, { projectId: fixture.projectId }),
    ).rejects.toThrow('tasks_disabled')
    await expect(
      owner.query(api.messages.listDetailed, {
        userId: fixture.ownerId,
        groupId: fixture.groupId,
        limit: 20,
      }),
    ).resolves.toEqual([])
    process.env.TRACK_TASKS_ENABLED = 'true'
  })

  it('keeps membership-loss cleanup active while task surfaces are disabled', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const created = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      title: 'Survive rollout disablement',
      assigneeProjectMemberId: fixture.staffMemberId,
      priority: 'none',
      idempotencyKey: 'flag-off-cleanup',
    })
    process.env.TRACK_TASKS_ENABLED = 'false'
    await fixture.t.run(
      async (ctx) =>
        await removeTaskMemberFromScope(ctx, {
          projectId: fixture.projectId,
          projectMemberId: fixture.staffMemberId,
        }),
    )
    const state = await fixture.t.run(async (ctx) => ({
      task: await ctx.db.get(created.taskId),
      follower: await ctx.db
        .query('taskFollowers')
        .withIndex('by_task_member', (q) =>
          q
            .eq('taskId', created.taskId)
            .eq('projectMemberId', fixture.staffMemberId),
        )
        .unique(),
    }))
    expect(state.task?.assigneeProjectMemberId).toBeUndefined()
    expect(state.follower?.enabled).toBe(false)
  })

  it('keeps Channel boards invisible to an administrator outside that Channel', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const outsider = fixture.t.withIdentity({ subject: 'outsider' })

    await owner.mutation(api.taskBoards.create, {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      name: 'Private delivery',
    })

    const ownerBoards = await owner.query(api.taskBoards.list, {
      projectId: fixture.projectId,
    })
    const outsiderBoards = await outsider.query(api.taskBoards.list, {
      projectId: fixture.projectId,
    })
    expect(ownerBoards.map((item) => item.board.name)).toContain(
      'Private delivery',
    )
    expect(outsiderBoards.map((item) => item.board.name)).not.toContain(
      'Private delivery',
    )
  })

  it('enforces scoped-client editing and assignment while staff can triage', async () => {
    const fixture = await seedLegacyProject()
    const client = fixture.t.withIdentity({ subject: 'client' })
    const staff = fixture.t.withIdentity({ subject: 'staff' })
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const boardId = await owner.mutation(api.taskBoards.create, {
      projectId: fixture.projectId,
      name: 'Delivery',
    })

    const created = await client.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId,
      title: 'Client-created task',
      assigneeProjectMemberId: fixture.clientMemberId,
      priority: 'medium',
      idempotencyKey: 'client-create-1',
    })
    await expect(
      client.mutation(api.tasks.update, {
        taskId: created.taskId,
        expectedRevision: 1,
        assigneeProjectMemberId: fixture.staffMemberId,
      }),
    ).rejects.toThrow('task_assignment_forbidden')
    await staff.mutation(api.tasks.update, {
      taskId: created.taskId,
      expectedRevision: 1,
      assigneeProjectMemberId: fixture.staffMemberId,
    })

    const ownerCreated = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId,
      title: 'Owner-created task',
      priority: 'none',
      idempotencyKey: 'owner-create-1',
    })
    await expect(
      client.mutation(api.tasks.update, {
        taskId: ownerCreated.taskId,
        expectedRevision: 1,
        title: 'Unauthorized edit',
      }),
    ).rejects.toThrow('task_edit_forbidden')
  })

  it('creates scoped evidence, live view data, and one-level subtasks idempotently', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const messageId = await fixture.t.run(
      async (ctx) =>
        await ctx.db.insert('messages', {
          projectId: fixture.projectId,
          groupId: fixture.groupId,
          authorId: fixture.ownerId,
          authorProjectMemberId: fixture.ownerMemberId,
          channelSequence: 1,
          body: 'Hasan will ship the task release.',
          mentions: [],
          attachmentIds: [],
          createdAt: Date.now(),
        }),
    )
    const created = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      title: 'Ship the task release',
      priority: 'urgent',
      references: [{ type: 'message', messageId, isPrimary: true }],
      idempotencyKey: 'message-task-1',
    })
    const repeated = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      title: 'Ignored retry title',
      priority: 'none',
      idempotencyKey: 'message-task-1',
    })
    expect(repeated.taskId).toBe(created.taskId)

    const detail = await owner.query(api.tasks.getByKey, {
      projectId: fixture.projectId,
      publicKey: created.publicKey,
    })
    expect(detail?.references[0]).toMatchObject({
      quote: 'Hasan will ship the task release.',
      isPrimary: true,
    })
    expect(detail?.task.publicKey).toMatch(/^T-[23456789A-Z]{8}$/)
    await fixture.t.mutation(internal.tasks.invalidateReferences, {
      messageId,
      redacted: true,
    })
    const redacted = await owner.query(api.tasks.getByKey, {
      projectId: fixture.projectId,
      publicKey: created.publicKey,
    })
    expect(redacted?.references[0]?.availability).toBe('redacted')
    expect(redacted?.references[0]?.quote).toBeUndefined()
    expect(
      await owner.query(api.tasks.listForMessage, { messageId }),
    ).toHaveLength(0)

    const subtask = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId: detail!.task.boardId,
      parentTaskId: created.taskId,
      title: 'Run the gate',
      priority: 'high',
      idempotencyKey: 'subtask-1',
    })
    await expect(
      owner.mutation(api.tasks.create, {
        projectId: fixture.projectId,
        boardId: detail!.task.boardId,
        parentTaskId: subtask.taskId,
        title: 'Nested too deeply',
        priority: 'none',
        idempotencyKey: 'subtask-2',
      }),
    ).rejects.toThrow('task_parent_invalid')
  })

  it('commits detection candidates only for the current generation and cursor', async () => {
    const fixture = await seedLegacyProject()
    const now = Date.now()
    const { messageId, runId } = await fixture.t.run(async (ctx) => {
      const messageId = await ctx.db.insert('messages', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        authorId: fixture.staffId,
        authorProjectMemberId: fixture.staffMemberId,
        channelSequence: 1,
        body: 'Please ship this tomorrow.',
        mentions: [],
        attachmentIds: [],
        createdAt: now,
      })
      await ctx.db.insert('taskDetectionSettings', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        enabled: true,
        generation: 2,
        highWaterSequence: 0,
        lastRunStatus: 'running',
        createdAt: now,
        updatedAt: now,
      })
      const runId = await ctx.db.insert('taskDetectionRuns', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        generation: 2,
        startSequence: 0,
        endSequence: 1,
        status: 'running',
        leaseToken: 'lease-current',
        leaseExpiresAt: now + 60_000,
        attempts: 1,
        correlationId: 'run-1',
        createdAt: now,
        updatedAt: now,
      })
      return { messageId, runId }
    })
    await fixture.t.mutation(internal.taskDetection.commitRun, {
      runId,
      leaseToken: 'lease-current',
      model: 'fake-v1',
      candidates: [
        {
          title: 'Ship this',
          priority: 'high',
          sourceMessageIds: [String(messageId)],
          confidence: 0.93,
          groundingReason: 'Explicit request.',
        },
      ],
    })
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const inbox = await owner.query(api.taskSuggestions.list, {
      projectId: fixture.projectId,
    })
    expect(inbox).toHaveLength(1)

    const staleRunId = await fixture.t.run(
      async (ctx) =>
        await ctx.db.insert('taskDetectionRuns', {
          projectId: fixture.projectId,
          groupId: fixture.groupId,
          generation: 1,
          startSequence: 0,
          endSequence: 1,
          status: 'running',
          leaseToken: 'lease-stale',
          leaseExpiresAt: now + 60_000,
          attempts: 1,
          correlationId: 'run-stale',
          createdAt: now,
          updatedAt: now,
        }),
    )
    await expect(
      fixture.t.mutation(internal.taskDetection.commitRun, {
        runId: staleRunId,
        leaseToken: 'lease-stale',
        model: 'fake-v1',
        candidates: [],
      }),
    ).resolves.toBe(false)
    const setting = await fixture.t.run(
      async (ctx) =>
        await ctx.db
          .query('taskDetectionSettings')
          .withIndex('by_group', (q) => q.eq('groupId', fixture.groupId))
          .unique(),
    )
    expect(setting?.highWaterSequence).toBe(1)
  })

  it('reconfigures workflows transactionally and migrates tasks through an explicit replacement', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const boardId = await owner.mutation(api.taskBoards.create, {
      projectId: fixture.projectId,
      name: 'Workflow',
    })
    const boards = await owner.query(api.taskBoards.list, {
      projectId: fixture.projectId,
    })
    const board = boards.find((item) => item.board._id === boardId)!
    const todo = board.states.find((state) => state.isDefault)!
    const done = board.states.find((state) => state.category === 'completed')!
    const created = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId,
      title: 'Migrate me',
      priority: 'none',
      idempotencyKey: 'workflow-task',
    })
    await owner.mutation(api.taskBoards.configureWorkflow, {
      boardId,
      defaultIndex: 0,
      replacementStateId: done._id,
      states: [
        { name: 'Ready', category: 'unstarted', visualToken: 'blue' },
        {
          stateId: done._id,
          name: 'Shipped',
          category: 'completed',
          visualToken: 'green',
        },
      ],
    })
    const task = await fixture.t.run(
      async (ctx) => await ctx.db.get(created.taskId),
    )
    expect(task?.workflowStateId).toBe(done._id)
    expect(
      (await fixture.t.run(async (ctx) => await ctx.db.get(todo._id)))
        ?.archivedAt,
    ).toBeTypeOf('number')
  })

  it('creates an idempotent grounded suggestion for explicit assistant task intent', async () => {
    const fixture = await seedLegacyProject()
    const messageId = await fixture.t.run(
      async (ctx) =>
        await ctx.db.insert('messages', {
          projectId: fixture.projectId,
          groupId: fixture.groupId,
          authorId: fixture.ownerId,
          authorProjectMemberId: fixture.ownerMemberId,
          channelSequence: 1,
          body: '@track create a task to publish the release notes',
          mentions: [],
          attachmentIds: [],
          createdAt: Date.now(),
        }),
    )
    const first = await fixture.t.mutation(
      internal.taskSuggestions.createExplicit,
      {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        requesterId: fixture.ownerId,
        promptMessageId: messageId,
        question: '@track create a task to publish the release notes',
      },
    )
    const second = await fixture.t.mutation(
      internal.taskSuggestions.createExplicit,
      {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        requesterId: fixture.ownerId,
        promptMessageId: messageId,
        question: '@track create a task to publish the release notes',
      },
    )
    expect(first).toMatchObject({ status: 'ready' })
    expect(second).toEqual(first)
  })

  it('keeps explicit history scans independent from the live detection cursor', async () => {
    const fixture = await seedLegacyProject()
    const now = Date.now()
    const { messageId, runId } = await fixture.t.run(async (ctx) => {
      const messageId = await ctx.db.insert('messages', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        authorId: fixture.ownerId,
        authorProjectMemberId: fixture.ownerMemberId,
        channelSequence: 5,
        body: 'Publish docs.',
        mentions: [],
        attachmentIds: [],
        createdAt: now,
      })
      await ctx.db.insert('taskDetectionSettings', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        enabled: false,
        generation: 4,
        highWaterSequence: 9,
        createdAt: now,
        updatedAt: now,
      })
      const runId = await ctx.db.insert('taskDetectionRuns', {
        projectId: fixture.projectId,
        groupId: fixture.groupId,
        generation: 4,
        mode: 'history',
        requestedByProjectMemberId: fixture.ownerMemberId,
        startSequence: 4,
        endSequence: 5,
        status: 'running',
        leaseToken: 'history',
        leaseExpiresAt: now + 60_000,
        attempts: 1,
        correlationId: 'history-run',
        createdAt: now,
        updatedAt: now,
      })
      return { messageId, runId }
    })
    await expect(
      fixture.t.mutation(internal.taskDetection.commitRun, {
        runId,
        leaseToken: 'history',
        model: 'fake-history',
        candidates: [
          {
            title: 'Publish docs',
            sourceMessageIds: [String(messageId)],
            confidence: 0.9,
            groundingReason: 'Explicit.',
          },
        ],
      }),
    ).resolves.toBe(true)
    const setting = await fixture.t.run(
      async (ctx) =>
        await ctx.db
          .query('taskDetectionSettings')
          .withIndex('by_group', (q) => q.eq('groupId', fixture.groupId))
          .unique(),
    )
    expect(setting?.highWaterSequence).toBe(9)
  })

  it('targets task push deep links only to the selected Project membership preference', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const staff = fixture.t.withIdentity({ subject: 'staff' })
    await staff.mutation(api.notifications.registerNativeToken, {
      userId: fixture.staffId,
      projectMemberId: fixture.staffMemberId,
      platform: 'ios',
      token: 'ExponentPushToken[test-staff]',
    })
    const created = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      title: 'Notify exact assignee',
      assigneeProjectMemberId: fixture.staffMemberId,
      priority: 'high',
      idempotencyKey: 'push-task',
    })
    const notification = await fixture.t.run(
      async (ctx) =>
        (
          await ctx.db
            .query('taskNotifications')
            .withIndex('by_member_created_at', (q) =>
              q.eq('recipientProjectMemberId', fixture.staffMemberId),
            )
            .collect()
        )[0]!,
    )
    const push = await fixture.t.query(
      internal.taskNotifications.collectPushTargets,
      { notificationId: notification._id },
    )
    expect(push?.mobileUrl).toBe(
      `/task?projectId=${fixture.projectId}&taskKey=${created.publicKey}`,
    )
    expect(push?.targets).toHaveLength(1)
    await staff.mutation(api.taskNotifications.setPreference, {
      projectId: fixture.projectId,
      mode: 'muted',
    })
    await expect(
      fixture.t.query(internal.taskNotifications.collectPushTargets, {
        notificationId: notification._id,
      }),
    ).resolves.toBeNull()
  })

  it('materializes Company-exit task archives from the cutoff snapshot and only allowed Channels', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const allowed = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      title: 'Visible at exit',
      priority: 'none',
      idempotencyKey: 'exit-visible',
    })
    const hiddenGroupId = await fixture.t.run(
      async (ctx) =>
        await ctx.db.insert('groups', {
          projectId: fixture.projectId,
          kind: 'custom',
          name: 'Unentitled Channel',
          createdBy: fixture.ownerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
    )
    await fixture.t.run(
      async (ctx) =>
        await ctx.db.insert('groupMembers', {
          projectId: fixture.projectId,
          groupId: hiddenGroupId,
          userId: fixture.ownerId,
          projectMemberId: fixture.ownerMemberId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
    )
    await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      groupId: hiddenGroupId,
      title: 'Hidden at exit',
      priority: 'none',
      idempotencyKey: 'exit-hidden',
    })

    const { entitlementId, projectCompanyId } = await fixture.t.run(
      async (ctx) => {
        const now = Date.now()
        const companyId = await ctx.db.insert('companies', {
          displayName: 'Archive Company',
          normalizedHandle: 'archive-company',
          status: 'active',
          revision: 1,
          createdBy: fixture.ownerId,
          createdAt: now,
          updatedAt: now,
        })
        const projectCompanyId = await ctx.db.insert('projectCompanies', {
          projectId: fixture.projectId,
          companyId,
          term: 1,
          status: 'exit_pending',
          acceptedBy: fixture.ownerId,
          acceptedAt: now,
          exitCutoff: now,
          createdAt: now,
          updatedAt: now,
        })
        await captureTaskExitStaging(ctx, {
          projectCompanyId,
          projectId: fixture.projectId,
          cutoff: now,
        })
        const entitlementId = await ctx.db.insert(
          'projectArchiveEntitlements',
          {
            projectId: fixture.projectId,
            projectCompanyId,
            companyId,
            projectMemberId: fixture.ownerMemberId,
            exitAt: now,
            channelIds: [fixture.groupId],
            projectSnapshot: {},
            channelSnapshots: [],
            retentionStatus: 'active',
            manifestHash: 'task-exit-test',
            createdAt: now,
            updatedAt: now,
          },
        )
        return { entitlementId, projectCompanyId }
      },
    )
    await owner.mutation(api.tasks.update, {
      taskId: allowed.taskId,
      expectedRevision: 1,
      title: 'Edited after cutoff',
    })
    await fixture.t.run(
      async (ctx) =>
        await materializeTaskArchiveSnapshots(ctx, {
          entitlementId,
          projectCompanyId,
          projectId: fixture.projectId,
          channelIds: [fixture.groupId],
        }),
    )
    const archivedTasks = await fixture.t.run(
      async (ctx) =>
        await ctx.db
          .query('taskArchiveSnapshots')
          .withIndex('by_entitlement_table', (q) =>
            q.eq('entitlementId', entitlementId).eq('sourceTable', 'tasks'),
          )
          .collect(),
    )
    expect(archivedTasks).toHaveLength(1)
    expect(archivedTasks[0]?.payload).toMatchObject({
      title: 'Visible at exit',
    })
  })
})

async function seedLegacyProject() {
  const t = convexTest(schema, modules)
  const fixture = await t.run(async (ctx) => {
    const now = Date.now()
    async function user(subject: string) {
      return await ctx.db.insert('users', {
        googleSubject: subject,
        email: `${subject}@example.test`,
        displayName: subject,
        twoFactorEnabled: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    const ownerId = await user('owner')
    const staffId = await user('staff')
    const clientId = await user('client')
    const outsiderId = await user('outsider')
    const projectId = await ctx.db.insert('projects', {
      name: 'Task Project',
      accessProfile: 'legacy',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    async function member(
      userId: Id<'users'>,
      role: 'owner' | 'admin' | 'staff' | 'client',
    ) {
      return await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role,
        createdAt: now,
        updatedAt: now,
      })
    }
    const ownerMemberId = await member(ownerId, 'owner')
    const staffMemberId = await member(staffId, 'staff')
    const clientMemberId = await member(clientId, 'client')
    await member(outsiderId, 'admin')
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'custom',
      name: 'Private Channel',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    for (const [userId, projectMemberId] of [
      [ownerId, ownerMemberId],
      [staffId, staffMemberId],
      [clientId, clientMemberId],
    ] as const)
      await ctx.db.insert('groupMembers', {
        projectId,
        groupId,
        userId,
        projectMemberId,
        createdAt: now,
        updatedAt: now,
      })
    return {
      projectId,
      groupId,
      ownerId,
      staffId,
      ownerMemberId,
      staffMemberId,
      clientMemberId,
    }
  })
  return { t, ...fixture }
}
