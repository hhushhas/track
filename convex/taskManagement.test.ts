import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

const originalTasksFlag = process.env.TRACK_TASKS_ENABLED

beforeEach(() => {
  process.env.TRACK_TASKS_ENABLED = 'true'
})

afterEach(() => {
  process.env.TRACK_TASKS_ENABLED = originalTasksFlag
})

describe('task management authorization and invariants', () => {
  it('keeps Channel boards invisible to an administrator outside that Channel', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const outsider = fixture.t.withIdentity({ subject: 'outsider' })

    await owner.mutation(api.taskBoards.create, {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      name: 'Private delivery',
    })

    const ownerBoards = await owner.query(api.taskBoards.list, { projectId: fixture.projectId })
    const outsiderBoards = await outsider.query(api.taskBoards.list, { projectId: fixture.projectId })
    expect(ownerBoards.map((item) => item.board.name)).toContain('Private delivery')
    expect(outsiderBoards.map((item) => item.board.name)).not.toContain('Private delivery')
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
    await expect(client.mutation(api.tasks.update, {
      taskId: created.taskId,
      expectedRevision: 1,
      assigneeProjectMemberId: fixture.staffMemberId,
    })).rejects.toThrow('task_assignment_forbidden')
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
    await expect(client.mutation(api.tasks.update, {
      taskId: ownerCreated.taskId,
      expectedRevision: 1,
      title: 'Unauthorized edit',
    })).rejects.toThrow('task_edit_forbidden')
  })

  it('creates scoped evidence, live view data, and one-level subtasks idempotently', async () => {
    const fixture = await seedLegacyProject()
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const messageId = await fixture.t.run(async (ctx) => await ctx.db.insert('messages', {
      projectId: fixture.projectId,
      groupId: fixture.groupId,
      authorId: fixture.ownerId,
      authorProjectMemberId: fixture.ownerMemberId,
      channelSequence: 1,
      body: 'Hasan will ship the task release.',
      mentions: [],
      attachmentIds: [],
      createdAt: Date.now(),
    }))
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
    expect(detail?.references[0]).toMatchObject({ quote: 'Hasan will ship the task release.', isPrimary: true })
    expect(detail?.task.publicKey).toMatch(/^T-[23456789A-Z]{8}$/)

    const subtask = await owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId: detail!.task.boardId,
      parentTaskId: created.taskId,
      title: 'Run the gate',
      priority: 'high',
      idempotencyKey: 'subtask-1',
    })
    await expect(owner.mutation(api.tasks.create, {
      projectId: fixture.projectId,
      boardId: detail!.task.boardId,
      parentTaskId: subtask.taskId,
      title: 'Nested too deeply',
      priority: 'none',
      idempotencyKey: 'subtask-2',
    })).rejects.toThrow('task_parent_invalid')
  })

  it('commits detection candidates only for the current generation and cursor', async () => {
    const fixture = await seedLegacyProject()
    const now = Date.now()
    const { messageId, runId } = await fixture.t.run(async (ctx) => {
      const messageId = await ctx.db.insert('messages', {
        projectId: fixture.projectId, groupId: fixture.groupId,
        authorId: fixture.staffId, authorProjectMemberId: fixture.staffMemberId,
        channelSequence: 1, body: 'Please ship this tomorrow.', mentions: [], attachmentIds: [], createdAt: now,
      })
      await ctx.db.insert('taskDetectionSettings', {
        projectId: fixture.projectId, groupId: fixture.groupId, enabled: true,
        generation: 2, highWaterSequence: 0, lastRunStatus: 'running', createdAt: now, updatedAt: now,
      })
      const runId = await ctx.db.insert('taskDetectionRuns', {
        projectId: fixture.projectId, groupId: fixture.groupId, generation: 2,
        startSequence: 0, endSequence: 1, status: 'running', leaseToken: 'lease-current',
        leaseExpiresAt: now + 60_000, attempts: 1, correlationId: 'run-1', createdAt: now, updatedAt: now,
      })
      return { messageId, runId }
    })
    await fixture.t.mutation(internal.taskDetection.commitRun, {
      runId,
      leaseToken: 'lease-current',
      model: 'fake-v1',
      candidates: [{
        title: 'Ship this', priority: 'high', sourceMessageIds: [String(messageId)],
        confidence: 0.93, groundingReason: 'Explicit request.',
      }],
    })
    const owner = fixture.t.withIdentity({ subject: 'owner' })
    const inbox = await owner.query(api.taskSuggestions.list, { projectId: fixture.projectId })
    expect(inbox).toHaveLength(1)

    const staleRunId = await fixture.t.run(async (ctx) => await ctx.db.insert('taskDetectionRuns', {
      projectId: fixture.projectId, groupId: fixture.groupId, generation: 1,
      startSequence: 0, endSequence: 1, status: 'running', leaseToken: 'lease-stale',
      leaseExpiresAt: now + 60_000, attempts: 1, correlationId: 'run-stale', createdAt: now, updatedAt: now,
    }))
    await expect(fixture.t.mutation(internal.taskDetection.commitRun, {
      runId: staleRunId,
      leaseToken: 'lease-stale',
      model: 'fake-v1',
      candidates: [],
    })).resolves.toBe(false)
    const setting = await fixture.t.run(async (ctx) => await ctx.db.query('taskDetectionSettings')
      .withIndex('by_group', (q) => q.eq('groupId', fixture.groupId)).unique())
    expect(setting?.highWaterSequence).toBe(1)
  })
})

async function seedLegacyProject() {
  const t = convexTest(schema, modules)
  const fixture = await t.run(async (ctx) => {
    const now = Date.now()
    async function user(subject: string) {
      return await ctx.db.insert('users', {
        googleSubject: subject, email: `${subject}@example.test`, displayName: subject,
        twoFactorEnabled: false, createdAt: now, updatedAt: now,
      })
    }
    const ownerId = await user('owner')
    const staffId = await user('staff')
    const clientId = await user('client')
    const outsiderId = await user('outsider')
    const projectId = await ctx.db.insert('projects', {
      name: 'Task Project', accessProfile: 'legacy', createdBy: ownerId, createdAt: now, updatedAt: now,
    })
    async function member(userId: Id<'users'>, role: 'owner' | 'admin' | 'staff' | 'client') {
      return await ctx.db.insert('projectMembers', { projectId, userId, role, createdAt: now, updatedAt: now })
    }
    const ownerMemberId = await member(ownerId, 'owner')
    const staffMemberId = await member(staffId, 'staff')
    const clientMemberId = await member(clientId, 'client')
    await member(outsiderId, 'admin')
    const groupId = await ctx.db.insert('groups', {
      projectId, kind: 'custom', name: 'Private Channel', createdBy: ownerId, createdAt: now, updatedAt: now,
    })
    for (const [userId, projectMemberId] of [
      [ownerId, ownerMemberId], [staffId, staffMemberId], [clientId, clientMemberId],
    ] as const) await ctx.db.insert('groupMembers', {
      projectId, groupId, userId, projectMemberId, createdAt: now, updatedAt: now,
    })
    return {
      projectId, groupId, ownerId, staffId,
      ownerMemberId, staffMemberId, clientMemberId,
    }
  })
  return { t, ...fixture }
}
