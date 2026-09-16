import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'

import { api } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('forwarded message source navigation', () => {
  it('returns the original thread ID only while the viewer can access its Channel', async () => {
    const t = convexTest(schema, modules)
    const fixture = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        authUserId: 'forward-source-viewer',
        googleSubject: 'forward-source-viewer',
        email: 'forward-source-viewer@track.local',
        displayName: 'Forward Source Viewer',
        twoFactorEnabled: false,
        createdAt: 1,
        updatedAt: 1,
      })
      const projectId = await ctx.db.insert('projects', {
        name: 'Forwarding Project',
        accessProfile: 'legacy',
        createdBy: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      const projectMemberId = await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role: 'manager',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      })
      const sourceGroupId = await ctx.db.insert('groups', {
        projectId,
        kind: 'custom',
        name: 'Source',
        createdBy: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      const targetGroupId = await ctx.db.insert('groups', {
        projectId,
        kind: 'custom',
        name: 'Target',
        createdBy: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      for (const groupId of [sourceGroupId, targetGroupId]) {
        await ctx.db.insert('groupMembers', {
          projectId,
          groupId,
          userId,
          projectMemberId,
          status: 'active',
          createdAt: 1,
          updatedAt: 1,
        })
      }
      const sourceMessageId = await ctx.db.insert('messages', {
        projectId,
        groupId: sourceGroupId,
        authorId: userId,
        authorProjectMemberId: projectMemberId,
        body: 'Original thread reply',
        mentions: [],
        attachmentIds: [],
        createdAt: 2,
      })
      const sourceThreadId = await ctx.db.insert('channelThreads', {
        projectId,
        groupId: sourceGroupId,
        name: 'Original thread',
        creatorUserId: userId,
        creatorProjectMemberId: projectMemberId,
        status: 'active',
        revision: 1,
        idempotencyKey: 'original-thread',
        createdAt: 2,
        updatedAt: 2,
      })
      await ctx.db.patch(sourceMessageId, { channelThreadId: sourceThreadId })
      await ctx.db.insert('messages', {
        projectId,
        groupId: targetGroupId,
        authorId: userId,
        authorProjectMemberId: projectMemberId,
        body: '',
        mentions: [],
        attachmentIds: [],
        forwardedFrom: {
          sourceProjectId: projectId,
          sourceGroupId,
          sourceMessageId,
          originalAuthorId: userId,
          originalAuthorName: 'Forward Source Viewer',
          originalBody: 'Original thread reply',
          originalCreatedAt: 2,
          attachmentSnapshots: [],
          forwardedAt: 3,
        },
        createdAt: 3,
      })
      return { sourceThreadId, targetGroupId, userId }
    })

    const messages = await t.withIdentity({ subject: 'forward-source-viewer' }).query(
      api.messages.listDetailed,
      { groupId: fixture.targetGroupId, userId: fixture.userId },
    )

    expect(messages[0]?.forwardedFrom).toMatchObject({
      canOpenSource: true,
      sourceChannelThreadId: fixture.sourceThreadId,
    })
  })
})
