import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'

import { api, internal } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('mobile attention queue', () => {
  it('combines unread task events and direct mentions in one scoped feed', async () => {
    process.env.TRACK_TASKS_ENABLED = 'true'
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', {
      authUserId: 'attention-owner',
      googleSubject: 'attention-owner',
      normalizedEmail: 'attention-owner@track.local',
      email: 'attention-owner@track.local',
      displayName: 'Attention Owner',
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    }))

    const seeded = await t.mutation(internal.demoSeed.seed, { email: 'attention-owner@track.local' })
    const fixture = await t.run(async (ctx) => {
      const member = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', seeded.projectId).eq('userId', userId),
      ).unique()
      const group = await ctx.db.query('groups').withIndex('by_project', (q) =>
        q.eq('projectId', seeded.projectId),
      ).first()
      const task = await ctx.db.query('tasks').withIndex('by_project_archived', (q) =>
        q.eq('projectId', seeded.projectId),
      ).first()
      if (!member || !group || !task) throw new Error('attention_fixture_incomplete')
      return { groupId: group._id, memberId: member._id, taskId: task._id }
    })

    const myTasks = await t.withIdentity({ subject: 'attention-owner' }).query(api.mobile.listMyTasks, { userId, openOnly: true })
    expect(myTasks.length).toBeGreaterThan(0)
    expect(myTasks[0]).toMatchObject({ project: { _id: seeded.projectId }, projectMemberId: fixture.memberId })

    const authorId = await t.run(async (ctx) => await ctx.db.insert('users', {
      authUserId: 'attention-author',
      googleSubject: 'attention-author',
      normalizedEmail: 'attention-author@track.local',
      email: 'attention-author@track.local',
      displayName: 'Attention Author',
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    }))
    await t.run(async (ctx) => {
      await ctx.db.insert('taskNotifications', {
        projectId: seeded.projectId,
        taskId: fixture.taskId,
        recipientProjectMemberId: fixture.memberId,
        recipientUserId: userId,
        eventType: 'assignment',
        payload: {},
        idempotencyKey: 'attention-task-event',
        createdAt: 10,
      })
      await ctx.db.insert('messages', {
        projectId: seeded.projectId,
        groupId: fixture.groupId,
        authorId,
        authorProjectMemberId: undefined,
        channelSequence: 99,
        body: 'Attention Owner, please review this decision.',
        mentions: [userId],
        mentionedProjectMemberIds: [fixture.memberId],
        attachmentIds: [],
        createdAt: 20,
      })
      const source = await ctx.db.query('messages')
        .withIndex('by_group_created_at', (q) => q.eq('groupId', fixture.groupId))
        .order('desc')
        .first()
      if (!source) throw new Error('attention_source_missing')
      const suggestionId = await ctx.db.insert('taskSuggestions', {
        projectId: seeded.projectId,
        groupId: fixture.groupId,
        proposedTitle: 'Review attention source',
        proposedDescription: 'Confirm the decision in the conversation.',
        proposedPriority: 'none',
        status: 'pending',
        confidence: 0.9,
        groundingReason: 'Grounded in the selected conversation.',
        fingerprint: 'attention-suggestion',
        modelVersion: 'test',
        promptVersion: 'test',
        createdAt: 30,
        updatedAt: 30,
      })
      await ctx.db.insert('taskSuggestionReferences', {
        projectId: seeded.projectId,
        suggestionId,
        type: 'message',
        groupId: fixture.groupId,
        messageId: source._id,
        availability: 'available',
        isPrimary: true,
        rank: '00000001',
        createdAt: 30,
        updatedAt: 30,
      })
    })

    const items = await t.withIdentity({ subject: 'attention-owner' }).query(api.mobile.listAttention, { userId })
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.kind)).toEqual(['suggestion', 'message', 'task'])
    expect(items[0]).toMatchObject({ eventType: 'task_suggestion', projectId: seeded.projectId })
    expect(items[1]).toMatchObject({ eventType: 'mention', projectId: seeded.projectId })
    expect(items[2]).toMatchObject({ eventType: 'assignment', projectId: seeded.projectId })

    // Legacy projects use user-scoped read states even when the client also
    // knows the project's membership id. Opening the message must remove it
    // from the attention feed rather than creating a parallel membership row.
    await t.withIdentity({ subject: 'attention-owner' }).mutation(api.mobile.markGroupRead, {
      groupId: fixture.groupId,
      userId,
      projectMemberId: fixture.memberId,
    })
    const afterRead = await t.withIdentity({ subject: 'attention-owner' }).query(api.mobile.listAttention, { userId })
    expect(afterRead.filter((item) => item.kind === 'message')).toEqual([])
  })

  it('does not return another user’s attention events', async () => {
    process.env.TRACK_TASKS_ENABLED = 'true'
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', {
      authUserId: 'attention-private',
      googleSubject: 'attention-private',
      normalizedEmail: 'attention-private@track.local',
      email: 'attention-private@track.local',
      displayName: 'Private Owner',
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    }))
    const seeded = await t.mutation(internal.demoSeed.seed, { email: 'attention-private@track.local' })
    const items = await t.withIdentity({ subject: 'attention-private' }).query(api.mobile.listAttention, { userId })
    expect(items).toEqual([])
    expect(seeded.projectId).toBeDefined()
  })
})
