import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('groups.listMembers', () => {
  it('keeps legacy members visible and rejects Project-only or removed actors', async () => {
    const t = convexTest(schema, modules)
    const fixture = await seedChannel(t)

    const members = await t.withIdentity({ subject: 'channel-owner' }).query(
      api.groups.listMembers,
      { groupId: fixture.groupId, userId: fixture.ownerId },
    )

    expect(members.map((item) => item.user?.displayName)).toEqual(['Channel owner'])
    await expect(t.withIdentity({ subject: 'project-only-member' }).query(
      api.groups.listMembers,
      { groupId: fixture.groupId, userId: fixture.projectOnlyMemberId },
    )).rejects.toThrow('not_group_member')
    const visible = await t.withIdentity({ subject: 'channel-owner' }).query(
      api.groups.listVisible,
      { projectId: fixture.projectId, userId: fixture.ownerId },
    )
    expect(visible.map((group) => group?._id)).toEqual([fixture.groupId])

    const removedVisible = await t.withIdentity({ subject: 'removed-channel-member' }).query(
      api.groups.listVisible,
      { projectId: fixture.projectId, userId: fixture.removedMemberId },
    )
    expect(removedVisible).toEqual([])
    await expect(t.withIdentity({ subject: 'removed-channel-member' }).query(
      api.groups.listMembers,
      { groupId: fixture.groupId, userId: fixture.removedMemberId },
    )).rejects.toThrow('not_group_member')
  })

  it('rejects cross-project channel membership and reactivates a removed project member', async () => {
    const t = convexTest(schema, modules)
    const fixture = await seedChannel(t)
    const secondGroupId = await t.run(async (ctx) => {
      const now = 2
      const secondProjectId = await ctx.db.insert('projects', {
        name: 'Different project',
        accessProfile: 'legacy',
        createdBy: fixture.ownerId,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('projectMembers', {
        projectId: secondProjectId,
        userId: fixture.ownerId,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      return await ctx.db.insert('groups', {
        projectId: secondProjectId,
        kind: 'custom',
        name: 'Other project channel',
        status: 'active',
        createdBy: fixture.ownerId,
        createdAt: now,
        updatedAt: now,
      })
    })

    await expect(t.withIdentity({ subject: 'channel-owner' }).mutation(
      api.groups.addGroupMember,
      {
        actorId: fixture.ownerId,
        groupId: secondGroupId,
        projectId: fixture.projectId,
        userId: fixture.projectOnlyMemberId,
      },
    )).rejects.toThrow('group_not_found')

    await t.run(async (ctx) => await ctx.db.patch(
      (await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', fixture.projectId).eq('userId', fixture.removedMemberId),
      ).unique())!._id,
      { status: 'removed' },
    ))
    await t.withIdentity({ subject: 'channel-owner' }).mutation(api.groups.addProjectMember, {
      actorId: fixture.ownerId,
      projectId: fixture.projectId,
      role: 'staff',
      userId: fixture.removedMemberId,
    })
    const reactivated = await t.run(async (ctx) => await ctx.db.query('projectMembers')
      .withIndex('by_project_user', (q) => q.eq('projectId', fixture.projectId).eq('userId', fixture.removedMemberId))
      .unique())
    expect(reactivated?.status).toBe('active')
  })

  it('rejects blank and oversized names at the mutation boundary', async () => {
    const t = convexTest(schema, modules)
    const fixture = await seedChannel(t)
    const owner = t.withIdentity({ subject: 'channel-owner' })
    await expect(owner.mutation(api.groups.create, {
      projectId: fixture.projectId,
      userId: fixture.ownerId,
      name: '   ',
    })).rejects.toThrow('group_name_required')
    await expect(owner.mutation(api.groups.create, {
      projectId: fixture.projectId,
      userId: fixture.ownerId,
      name: 'x'.repeat(81),
    })).rejects.toThrow('group_name_too_long')

    const newUserId = await seedUser(t, 'new-project-owner', 'New project owner')
    await expect(t.withIdentity({ subject: 'new-project-owner' }).mutation(api.projects.create, {
      userId: newUserId,
      name: '   ',
    })).rejects.toThrow('project_name_required')
    await expect(t.withIdentity({ subject: 'new-project-owner' }).mutation(api.projects.create, {
      userId: newUserId,
      name: 'x'.repeat(121),
    })).rejects.toThrow('project_name_too_long')
  })
})

async function seedChannel(t: ReturnType<typeof convexTest>) {
  const now = 1
  const ownerId = await seedUser(t, 'channel-owner', 'Channel owner')
  const projectOnlyMemberId = await seedUser(t, 'project-only-member', 'Project-only member')
  const removedMemberId = await seedUser(t, 'removed-channel-member', 'Removed channel member')

  return await t.run(async (ctx) => {
    const projectId = await ctx.db.insert('projects', {
      name: 'Membership source',
      accessProfile: 'legacy',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    const groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'custom',
      name: 'Authorized Channel',
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    for (const userId of [ownerId, projectOnlyMemberId, removedMemberId]) {
      await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role: userId === ownerId ? 'owner' : 'staff',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: removedMemberId,
      status: 'removed',
      createdAt: now,
      updatedAt: now,
    })
    return { groupId, ownerId, projectId, projectOnlyMemberId, removedMemberId }
  })
}

async function seedUser(t: ReturnType<typeof convexTest>, authUserId: string, displayName: string) {
  return await t.run(async (ctx) => await ctx.db.insert('users', {
    authUserId,
    googleSubject: authUserId,
    normalizedEmail: `${authUserId}@track.test`,
    email: `${authUserId}@track.test`,
    displayName,
    twoFactorEnabled: false,
    createdAt: 1,
    updatedAt: 1,
  }))
}
