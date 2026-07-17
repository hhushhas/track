import { convexTest } from 'convex-test'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

type TestBackend = ReturnType<typeof convexTest>

const originalCompanyFlag = process.env.TRACK_COMPANY_MODEL_ENABLED
const originalTasksFlag = process.env.TRACK_TASKS_ENABLED
const originalThreadsFlag = process.env.TRACK_THREADS_ENABLED

beforeEach(() => {
  process.env.TRACK_COMPANY_MODEL_ENABLED = 'false'
  process.env.TRACK_TASKS_ENABLED = 'false'
  process.env.TRACK_THREADS_ENABLED = 'true'
})

afterEach(() => {
  process.env.TRACK_COMPANY_MODEL_ENABLED = originalCompanyFlag
  process.env.TRACK_TASKS_ENABLED = originalTasksFlag
  process.env.TRACK_THREADS_ENABLED = originalThreadsFlag
})

describe('Channel threads', () => {
  it('adds task behavior only when both releases are enabled and hides thread evidence otherwise', async () => {
    process.env.TRACK_TASKS_ENABLED = 'true'
    const { groupId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const scanFrom = Date.now() - 1_000
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'combined-thread',
      name: 'Combined behavior',
      projectId,
    })
    const messageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Turn this focused decision into tracked work.',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'combined-thread-message',
      projectId,
    })
    const created = await actor.mutation(api.tasks.create, {
      projectId,
      groupId,
      title: 'Track the focused decision',
      priority: 'none',
      references: [{ type: 'message', messageId, isPrimary: true }],
      idempotencyKey: 'combined-thread-task',
    })

    expect(await actor.query(api.tasks.listForMessage, { messageId })).toHaveLength(1)
    expect(await actor.query(api.tasks.getByKey, {
      projectId,
      publicKey: created.publicKey,
    })).toMatchObject({
      references: [{ availability: 'available', channelThreadId: threadId }],
    })

    process.env.TRACK_THREADS_ENABLED = 'false'
    expect(await actor.query(api.tasks.listForMessage, { messageId })).toEqual([])
    const tasksOnlyDetail = await actor.query(api.tasks.getByKey, {
      projectId,
      publicKey: created.publicKey,
    })
    expect(tasksOnlyDetail?.references[0]).toMatchObject({ availability: 'unavailable' })
    expect(tasksOnlyDetail?.references[0]?.quote).toBeUndefined()
    expect(await actor.mutation(api.taskDetection.requestHistoryScan, {
      projectId,
      groupId,
      from: scanFrom,
      to: Date.now() + 1_000,
    })).toBeNull()
    await expect(actor.mutation(api.tasks.create, {
      projectId,
      groupId,
      title: 'Do not expose disabled thread evidence',
      priority: 'none',
      references: [{ type: 'message', messageId, isPrimary: true }],
      idempotencyKey: 'disabled-thread-task',
    })).rejects.toThrow('task_reference_invalid')

    process.env.TRACK_TASKS_ENABLED = 'false'
    process.env.TRACK_THREADS_ENABLED = 'true'
    expect(await actor.query(api.channelThreads.get, { threadId, userId: owner }))
      .toMatchObject({ thread: { _id: threadId } })
    await expect(actor.query(api.taskBoards.list, { projectId }))
      .rejects.toThrow('tasks_disabled')
  })
  it('fails closed when the release is disabled', async () => {
    process.env.TRACK_THREADS_ENABLED = 'false'
    const { groupId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)

    expect(await actor.query(api.channelThreads.list, { groupId, userId: owner })).toEqual([])
    await expect(actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'disabled-create',
      name: 'Hidden thread',
      projectId,
    })).rejects.toThrow('threads_disabled')
  })

  it('hides persisted thread evidence when the release is disabled', async () => {
    const { groupId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'disabled-existing-thread',
      name: 'Persisted while disabled',
      projectId,
    })
    const messageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Hidden persisted reply',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'disabled-existing-message',
      projectId,
    })

    process.env.TRACK_THREADS_ENABLED = 'false'
    expect(await actor.query(api.channelThreads.get, { threadId, userId: owner })).toBeNull()
    expect(await actor.query(api.channelThreads.listMessages, { threadId, userId: owner })).toEqual([])
    expect(await actor.query(api.assistant.listForThread, { threadId, userId: owner })).toEqual([])
    expect((await actor.query(api.search.project, {
      projectId,
      query: 'Hidden persisted',
      userId: owner,
    })).messages).toEqual([])
    await expect(actor.mutation(api.reports.create, {
      projectId,
      reason: 'other',
      reporterId: owner,
      targetMessageId: messageId,
      targetType: 'message',
    })).rejects.toThrow('threads_disabled')
  })

  it('converges create and send retries while keeping thread messages out of the timeline', async () => {
    const { groupId, member, owner, projectId, t } = await seedLegacyChannel()
    const ownerActor = asUser(t, owner)
    const sourceMessageId = await ownerActor.mutation(api.messages.send, {
      authorId: owner,
      body: 'We should decide this separately.',
      groupId,
      idempotencyKey: 'source-message',
      projectId,
    })
    const createArgs = {
      creatorId: owner,
      groupId,
      idempotencyKey: 'create-decision-thread',
      name: ' Decision   log ',
      projectId,
      sourceMessageId,
    }
    const threadId = await ownerActor.mutation(api.channelThreads.create, createArgs)

    expect(await ownerActor.mutation(api.channelThreads.create, createArgs)).toBe(threadId)
    expect(await ownerActor.mutation(api.channelThreads.create, {
      ...createArgs,
      idempotencyKey: 'same-source-concurrent-retry',
    })).toBe(threadId)

    const sendArgs = {
      authorId: owner,
      body: 'First focused reply',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'thread-reply-1',
      mentions: [member],
      projectId,
    }
    const replyId = await ownerActor.mutation(api.messages.send, sendArgs)
    expect(await ownerActor.mutation(api.messages.send, sendArgs)).toBe(replyId)

    const timeline = await ownerActor.query(api.messages.list, { groupId, userId: owner })
    const replies = await ownerActor.query(api.channelThreads.listMessages, {
      threadId,
      userId: owner,
    })
    const memberThreads = await asUser(t, member).query(api.channelThreads.list, {
      groupId,
      userId: member,
    })

    expect(timeline.map((message) => message._id)).toEqual([sourceMessageId])
    expect(replies.map((item) => item.message._id)).toEqual([replyId])
    expect(memberThreads[0]).toMatchObject({ following: true, replyCount: 1, unread: true })
    expect(memberThreads[0].thread).toMatchObject({ name: 'Decision log', sourceMessageId })
  })

  it('keeps follow and read state private and clears unread when opened', async () => {
    const { groupId, member, owner, projectId, t } = await seedLegacyChannel()
    const threadId = await asUser(t, owner).mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'follow-thread',
      name: 'Follow behavior',
      projectId,
    })
    await asUser(t, member).mutation(api.channelThreads.setFollowing, {
      following: true,
      threadId,
      userId: member,
    })
    await asUser(t, owner).mutation(api.messages.send, {
      authorId: owner,
      body: 'Unread for the follower',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'unread-reply',
      projectId,
    })

    expect((await asUser(t, member).query(api.channelThreads.get, { threadId, userId: member }))?.unread)
      .toBe(true)
    await asUser(t, member).mutation(api.channelThreads.markRead, { threadId, userId: member })
    expect((await asUser(t, member).query(api.channelThreads.get, { threadId, userId: member }))?.unread)
      .toBe(false)
    await asUser(t, member).mutation(api.channelThreads.setFollowing, {
      following: false,
      threadId,
      userId: member,
    })
    await asUser(t, owner).mutation(api.messages.send, {
      authorId: owner,
      body: 'Not unread after explicit unfollow',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'unfollowed-reply',
      projectId,
    })
    expect(await asUser(t, member).query(api.channelThreads.get, { threadId, userId: member }))
      .toMatchObject({ following: false, unread: false })
  })

  it('advances read state while an archived parent Channel remains readable', async () => {
    const { groupId, member, owner, projectId, t } = await seedLegacyChannel()
    const threadId = await asUser(t, owner).mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'archived-parent-thread',
      name: 'Archived parent',
      projectId,
    })
    await asUser(t, member).mutation(api.channelThreads.setFollowing, {
      following: true,
      threadId,
      userId: member,
    })
    await asUser(t, owner).mutation(api.messages.send, {
      authorId: owner,
      body: 'Read after the Channel archives',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'archived-parent-reply',
      projectId,
    })
    await t.run(async (ctx) => await ctx.db.patch(groupId, { status: 'archived' }))

    await asUser(t, member).mutation(api.channelThreads.markRead, { threadId, userId: member })
    expect(await asUser(t, member).query(api.channelThreads.get, { threadId, userId: member }))
      .toMatchObject({ unread: false })
  })

  it('paginates long history and includes an exact deep-link target', async () => {
    const { groupId, owner, ownerMembershipId, projectId, t } = await seedLegacyChannel()
    const threadId = await asUser(t, owner).mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'long-history-thread',
      name: 'Long history',
      projectId,
    })
    const targetMessageId = await t.run(async (ctx) => {
      let firstMessageId: Id<'messages'> | null = null
      const startedAt = Date.now()
      for (let index = 1; index <= 130; index += 1) {
        const messageId = await ctx.db.insert('messages', {
          projectId,
          groupId,
          authorId: owner,
          authorProjectMemberId: ownerMembershipId,
          channelThreadId: threadId,
          channelSequence: index,
          body: `History reply ${index}`,
          mentions: [],
          attachmentIds: [],
          createdAt: startedAt + index,
        })
        firstMessageId ??= messageId
      }
      await ctx.db.patch(threadId, {
        replyCount: 130,
        latestReplyAt: startedAt + 130,
        latestChannelSequence: 130,
      })
      return firstMessageId!
    })

    const firstPage = await asUser(t, owner).query(api.channelThreads.listMessagePage, {
      threadId,
      userId: owner,
      targetMessageId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(firstPage.isDone).toBe(false)
    expect(firstPage.page).toHaveLength(51)
    expect(firstPage.page.some((item) => item.message._id === targetMessageId)).toBe(true)
    const secondPage = await asUser(t, owner).query(api.channelThreads.listMessagePage, {
      threadId,
      userId: owner,
      paginationOpts: { cursor: firstPage.continueCursor, numItems: 50 },
    })
    expect(secondPage.page).toHaveLength(50)
    expect(await asUser(t, owner).query(api.channelThreads.get, { threadId, userId: owner }))
      .toMatchObject({ replyCount: 130 })
  })

  it('enforces creator or steward lifecycle authority and revision conflicts', async () => {
    const { groupId, member, owner, projectId, t } = await seedLegacyChannel()
    const threadId = await asUser(t, owner).mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'lifecycle-thread',
      name: 'Lifecycle',
      projectId,
    })

    await expect(asUser(t, member).mutation(api.channelThreads.setStatus, {
      expectedRevision: 1,
      status: 'archived',
      threadId,
      userId: member,
    })).rejects.toThrow('thread_steward_required')

    expect(await asUser(t, owner).mutation(api.channelThreads.setStatus, {
      expectedRevision: 1,
      status: 'archived',
      threadId,
      userId: owner,
    })).toMatchObject({ conflict: false, revision: 2, status: 'archived' })
    expect(await asUser(t, owner).mutation(api.channelThreads.setStatus, {
      expectedRevision: 1,
      status: 'active',
      threadId,
      userId: owner,
    })).toMatchObject({ conflict: true, revision: 2, status: 'archived' })
    await expect(asUser(t, owner).mutation(api.messages.send, {
      authorId: owner,
      body: 'Rejected while archived',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'archived-reply',
      projectId,
    })).rejects.toThrow('thread_archived')
    expect(await asUser(t, owner).mutation(api.channelThreads.setStatus, {
      expectedRevision: 2,
      status: 'active',
      threadId,
      userId: owner,
    })).toMatchObject({ conflict: false, revision: 3, status: 'active' })

    await t.run(async (ctx) => await ctx.db.patch(groupId, { status: 'archived' }))
    await expect(asUser(t, owner).mutation(api.messages.send, {
      authorId: owner,
      body: 'Rejected under an archived Channel',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'archived-channel-reply',
      projectId,
    })).rejects.toThrow('thread_parent_read_only')
    await expect(asUser(t, owner).mutation(api.channelThreads.setFollowing, {
      following: false,
      threadId,
      userId: owner,
    })).rejects.toThrow('thread_parent_read_only')
    expect(await asUser(t, owner).query(api.channelThreads.get, { threadId, userId: owner }))
      .toMatchObject({ thread: { status: 'active' } })
  })

  it('returns a generic unavailable state and keeps a thread after source deletion', async () => {
    const { groupId, outsider, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const sourceMessageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Disposable source',
      groupId,
      idempotencyKey: 'disposable-source',
      projectId,
    })
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'durable-thread',
      name: 'Durable discussion',
      projectId,
      sourceMessageId,
    })

    expect(await asUser(t, outsider).query(api.channelThreads.get, { threadId, userId: outsider }))
      .toBeNull()
    expect(await asUser(t, outsider).query(api.channelThreads.listMessages, { threadId, userId: outsider }))
      .toEqual([])
    expect(await asUser(t, outsider).query(api.assistant.listForThread, { threadId, userId: outsider }))
      .toEqual([])
    await t.run(async (ctx) => await ctx.db.delete(sourceMessageId))
    const retained = await actor.query(api.channelThreads.get, { threadId, userId: owner })
    expect(retained?.thread._id).toBe(threadId)
    expect(retained?.source).toEqual({ unavailable: true })
  })

  it('keeps follow and unread state separate across Acting Company memberships', async () => {
    process.env.TRACK_COMPANY_MODEL_ENABLED = 'true'
    const {
      firstCompanyId,
      firstMembershipId,
      firstRecipientMembershipId,
      groupId,
      projectId,
      recipientUserId,
      secondCompanyId,
      secondMembershipId,
      secondRecipientMembershipId,
      t,
      userId,
    } =
      await seedMultiCompanyChannel()
    const actor = asUser(t, userId)
    const firstContext = {
      actingCompanyId: firstCompanyId,
      projectMemberId: firstMembershipId,
    }
    const secondContext = {
      actingCompanyId: secondCompanyId,
      projectMemberId: secondMembershipId,
    }
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: userId,
      groupId,
      idempotencyKey: 'multi-company-thread',
      name: 'Exact represented context',
      projectId,
      ...firstContext,
    })

    expect(await actor.query(api.channelThreads.get, {
      threadId,
      userId,
      ...firstContext,
    })).toMatchObject({ following: true })
    expect(await actor.query(api.channelThreads.get, {
      threadId,
      userId,
      ...secondContext,
    })).toMatchObject({ following: false, unread: false })

    await actor.mutation(api.channelThreads.setFollowing, {
      following: true,
      threadId,
      userId,
      ...secondContext,
    })
    await actor.mutation(api.messages.send, {
      authorId: userId,
      body: 'Authored through the first Company',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'multi-company-reply',
      projectId,
      ...firstContext,
    })
    expect(await actor.query(api.channelThreads.get, {
      threadId,
      userId,
      ...firstContext,
    })).toMatchObject({ unread: false })
    expect(await actor.query(api.channelThreads.get, {
      threadId,
      userId,
      ...secondContext,
    })).toMatchObject({ unread: true })
    expect((await actor.query(api.mobile.listGroups, {
      projectId,
      userId,
      ...firstContext,
    }))[0]).toMatchObject({ unreadCount: 0 })
    expect((await actor.query(api.mobile.listGroups, {
      projectId,
      userId,
      ...secondContext,
    }))[0]).toMatchObject({ unreadCount: 1 })
    expect(await actor.query(api.channelThreads.listGroupUnread, {
      projectId,
      userId,
      ...firstContext,
    })).toEqual([])
    expect(await actor.query(api.channelThreads.listGroupUnread, {
      projectId,
      userId,
      ...secondContext,
    })).toEqual([{ groupId, unreadCount: 1 }])

    await actor.mutation(api.messages.send, {
      authorId: userId,
      body: 'Ambiguous @recipient mention',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'ambiguous-company-mention',
      mentions: [recipientUserId],
      projectId,
      ...firstContext,
    })
    const recipient = asUser(t, recipientUserId)
    expect(await recipient.query(api.channelThreads.get, {
      threadId,
      userId: recipientUserId,
      actingCompanyId: firstCompanyId,
      projectMemberId: firstRecipientMembershipId,
    })).toMatchObject({ following: false })
    expect(await recipient.query(api.channelThreads.get, {
      threadId,
      userId: recipientUserId,
      actingCompanyId: secondCompanyId,
      projectMemberId: secondRecipientMembershipId,
    })).toMatchObject({ following: false })

    await actor.mutation(api.messages.send, {
      authorId: userId,
      body: 'Exact @recipient mention',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'exact-company-mention',
      mentionedProjectMemberIds: [secondRecipientMembershipId],
      mentions: [recipientUserId],
      projectId,
      ...firstContext,
    })
    expect(await recipient.query(api.channelThreads.get, {
      threadId,
      userId: recipientUserId,
      actingCompanyId: firstCompanyId,
      projectMemberId: firstRecipientMembershipId,
    })).toMatchObject({ following: false })
    expect(await recipient.query(api.channelThreads.get, {
      threadId,
      userId: recipientUserId,
      actingCompanyId: secondCompanyId,
      projectMemberId: secondRecipientMembershipId,
    })).toMatchObject({ following: true })
  })

  it('searches and reports thread evidence without copying message content', async () => {
    const { groupId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'search-thread',
      name: 'Architecture decisions',
      projectId,
    })
    const messageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Choose the durable queue boundary',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'search-thread-message',
      projectId,
    })

    const nameResults = await actor.query(api.search.project, {
      projectId,
      query: 'Architecture',
      userId: owner,
    })
    const messageResults = await actor.query(api.search.project, {
      projectId,
      query: 'durable queue',
      userId: owner,
    })
    expect(nameResults.threads).toEqual([
      expect.objectContaining({ threadId, title: 'Architecture decisions' }),
    ])
    expect(messageResults.messages).toEqual([
      expect.objectContaining({ messageId, threadId }),
    ])

    const reportId = await actor.mutation(api.reports.create, {
      projectId,
      reason: 'other',
      reporterId: owner,
      targetMessageId: messageId,
      targetType: 'message',
    })
    const report = await t.run(async (ctx) => await ctx.db.get(reportId))
    expect(report).toMatchObject({ channelThreadId: threadId, groupId, targetMessageId: messageId })
    expect(report).not.toHaveProperty('messageBody')
  })

  it('applies Channel access before capping thread search results', async () => {
    const { groupId, member, owner, ownerMembershipId, projectId, t } = await seedLegacyChannel()
    const visibleThreadId = await asUser(t, owner).mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'visible-search-thread',
      name: 'Needle visible',
      projectId,
    })
    await t.run(async (ctx) => {
      const now = Date.now()
      const hiddenGroupId = await ctx.db.insert('groups', {
        projectId,
        kind: 'custom',
        name: 'Hidden',
        status: 'active',
        revision: 1,
        createdBy: owner,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('groupMembers', {
        projectId,
        groupId: hiddenGroupId,
        userId: owner,
        projectMemberId: ownerMembershipId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      for (let index = 0; index < 30; index += 1) {
        await ctx.db.insert('channelThreads', {
          projectId,
          groupId: hiddenGroupId,
          name: `Needle hidden ${index}`,
          creatorUserId: owner,
          creatorProjectMemberId: ownerMembershipId,
          status: 'active',
          revision: 1,
          replyCount: 0,
          latestChannelSequence: 0,
          idempotencyKey: `hidden-search-${index}`,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
    })

    const results = await asUser(t, member).query(api.search.project, {
      filter: 'threads',
      limit: 3,
      projectId,
      query: 'Needle',
      userId: member,
    })
    expect(results.threads.map((thread) => thread.threadId)).toEqual([visibleThreadId])
  })

  it('collects bounded whole-Channel assistant context including threads but excludes another Channel', async () => {
    const { groupId, owner, ownerMembershipId, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const otherGroupId = await t.run(async (ctx) => {
      const now = Date.now()
      const id = await ctx.db.insert('groups', {
        projectId,
        kind: 'custom',
        name: 'Other Channel',
        status: 'active',
        revision: 1,
        createdBy: owner,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('groupMembers', {
        projectId,
        groupId: id,
        userId: owner,
        projectMemberId: ownerMembershipId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      return id
    })
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'assistant-thread',
      name: 'Assistant context',
      projectId,
    })
    await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Timeline fact',
      groupId,
      idempotencyKey: 'timeline-fact',
      projectId,
    })
    await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Thread fact',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'thread-fact',
      projectId,
    })
    await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Other Channel secret',
      groupId: otherGroupId,
      idempotencyKey: 'other-channel-fact',
      projectId,
    })

    const context = await actor.query(api.assistant.collectContext, {
      groupId,
      projectId,
      question: 'What facts exist?',
      requesterId: owner,
    })
    expect(context.messages.map((message) => message.body)).toEqual([
      'Timeline fact',
      'Thread fact',
    ])
  })

  it('targets ordinary thread notifications only to followers while mentions still follow and notify', async () => {
    const { groupId, member, memberMembershipId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'notification-thread',
      name: 'Notification behavior',
      projectId,
    })
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('notificationSettings', {
        userId: member,
        globalMode: 'all',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('notificationSubscriptions', {
        userId: member,
        platform: 'ios',
        tokenOrEndpoint: 'ExponentPushToken[test]',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
    })
    const unfollowedMessageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'No ordinary delivery',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'unfollowed-notification',
      projectId,
    })
    expect((await t.query(internal.notifications.collectMessageNotificationTargets, {
      messageId: unfollowedMessageId,
    }))?.targets).toHaveLength(0)

    await asUser(t, member).mutation(api.channelThreads.setFollowing, {
      following: true,
      threadId,
      userId: member,
    })
    const followedMessageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Follower delivery',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'followed-notification',
      projectId,
    })
    expect((await t.query(internal.notifications.collectMessageNotificationTargets, {
      messageId: followedMessageId,
    }))?.targets).toHaveLength(1)

    await asUser(t, member).mutation(api.channelThreads.setFollowing, {
      following: false,
      threadId,
      userId: member,
    })
    const mentionMessageId = await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Direct mention',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'mention-notification',
      mentions: [member],
      projectId,
    })
    const mentionDelivery = await t.query(internal.notifications.collectMessageNotificationTargets, {
      messageId: mentionMessageId,
    })
    expect(mentionDelivery?.targets).toEqual([
      expect.objectContaining({ projectMemberId: memberMembershipId }),
    ])
    expect(mentionDelivery?.url).toContain(`#message-${mentionMessageId}`)
  })

  it('removes thread-owned rows during a legacy Project hard delete', async () => {
    const { groupId, owner, projectId, t } = await seedLegacyChannel()
    const actor = asUser(t, owner)
    const threadId = await actor.mutation(api.channelThreads.create, {
      creatorId: owner,
      groupId,
      idempotencyKey: 'cleanup-thread',
      name: 'Cleanup thread',
      projectId,
    })
    await actor.mutation(api.messages.send, {
      authorId: owner,
      body: 'Cleanup reply',
      channelThreadId: threadId,
      groupId,
      idempotencyKey: 'cleanup-reply',
      projectId,
    })

    await actor.mutation(api.projects.remove, { projectId, userId: owner })
    const remains = await t.run(async (ctx) => ({
      followers: await ctx.db.query('channelThreadFollowers').collect(),
      reads: await ctx.db.query('channelThreadReadStates').collect(),
      threads: await ctx.db.query('channelThreads').collect(),
    }))
    expect(remains).toEqual({ followers: [], reads: [], threads: [] })
  })
})

async function seedLegacyChannel() {
  const t = convexTest(schema, modules)
  registerRateLimiter(t)
  const owner = await seedUser(t, 'thread-owner')
  const member = await seedUser(t, 'thread-member')
  const outsider = await seedUser(t, 'thread-outsider')
  const now = Date.now()
  const fixture = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert('projects', {
      accessProfile: 'legacy',
      name: 'Thread Project',
      createdBy: owner,
      createdAt: now,
      updatedAt: now,
    })
    const ownerMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: owner,
      role: 'owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    const memberMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: member,
      role: 'staff',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'general',
      name: 'General',
      status: 'active',
      revision: 1,
      createdBy: owner,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: owner,
      projectMemberId: ownerMembershipId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: member,
      projectMemberId: memberMembershipId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    return { groupId, memberMembershipId, ownerMembershipId, projectId }
  })
  return { ...fixture, member, outsider, owner, t }
}

async function seedUser(t: TestBackend, subject: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      googleSubject: subject,
      email: `${subject}@example.test`,
      displayName: subject,
      twoFactorEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await ctx.db.patch(userId, { authUserId: String(userId) })
    return userId
  })
}

function asUser(t: TestBackend, userId: Id<'users'>) {
  return t.withIdentity({ subject: String(userId) })
}

async function seedMultiCompanyChannel() {
  const t = convexTest(schema, modules)
  registerRateLimiter(t)
  const userId = await seedUser(t, 'multi-company-thread-user')
  const recipientUserId = await seedUser(t, 'multi-company-thread-recipient')
  const now = Date.now()
  const fixture = await t.run(async (ctx) => {
    const firstCompanyId = await ctx.db.insert('companies', {
      displayName: 'First Company',
      normalizedHandle: 'first-thread-company',
      status: 'active',
      revision: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    const secondCompanyId = await ctx.db.insert('companies', {
      displayName: 'Second Company',
      normalizedHandle: 'second-thread-company',
      status: 'active',
      revision: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    for (const [companyId, displayName] of [
      [firstCompanyId, 'First Company'],
      [secondCompanyId, 'Second Company'],
    ] as const) {
      await ctx.db.insert('companyMembers', {
        companyId,
        userId,
        role: 'owner',
        status: 'active',
        userDisplayNameSnapshot: 'Multi Company User',
        companyDisplayNameSnapshot: displayName,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('companyMembers', {
        companyId,
        userId: recipientUserId,
        role: 'member',
        status: 'active',
        userDisplayNameSnapshot: 'Multi Company Recipient',
        companyDisplayNameSnapshot: displayName,
        createdAt: now,
        updatedAt: now,
      })
    }
    const projectId = await ctx.db.insert('projects', {
      accessProfile: 'company',
      name: 'Shared represented Project',
      origin: 'shared',
      status: 'active',
      participantRevision: 1,
      revision: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    const firstProjectCompanyId = await ctx.db.insert('projectCompanies', {
      projectId,
      companyId: firstCompanyId,
      term: 1,
      status: 'active',
      acceptedBy: userId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const secondProjectCompanyId = await ctx.db.insert('projectCompanies', {
      projectId,
      companyId: secondCompanyId,
      term: 1,
      status: 'active',
      acceptedBy: userId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const firstMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId,
      role: 'member',
      companyId: firstCompanyId,
      projectCompanyId: firstProjectCompanyId,
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })
    const secondMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId,
      role: 'member',
      companyId: secondCompanyId,
      projectCompanyId: secondProjectCompanyId,
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })
    const firstRecipientMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: recipientUserId,
      role: 'member',
      companyId: firstCompanyId,
      projectCompanyId: firstProjectCompanyId,
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })
    const secondRecipientMembershipId = await ctx.db.insert('projectMembers', {
      projectId,
      userId: recipientUserId,
      role: 'member',
      companyId: secondCompanyId,
      projectCompanyId: secondProjectCompanyId,
      status: 'active',
      term: 1,
      createdAt: now,
      updatedAt: now,
    })
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'general',
      name: 'Shared General',
      status: 'active',
      revision: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    for (const projectMemberId of [
      firstMembershipId,
      secondMembershipId,
      firstRecipientMembershipId,
      secondRecipientMembershipId,
    ]) {
      const membership = await ctx.db.get(projectMemberId)
      await ctx.db.insert('groupMembers', {
        projectId,
        groupId,
        userId: membership!.userId,
        projectMemberId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }
    return {
      firstCompanyId,
      firstMembershipId,
      firstRecipientMembershipId,
      groupId,
      projectId,
      recipientUserId,
      secondCompanyId,
      secondMembershipId,
      secondRecipientMembershipId,
    }
  })
  return { ...fixture, t, userId }
}
