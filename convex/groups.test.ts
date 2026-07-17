import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('groups.listMembers', () => {
  it('returns only active members of the authorized Channel', async () => {
    const t = convexTest(schema, modules)
    const fixture = await seedChannel(t)

    const members = await t.withIdentity({ subject: 'channel-owner' }).query(
      api.groups.listMembers,
      { groupId: fixture.groupId, userId: fixture.ownerId },
    )

    expect(members.map((item) => item.user?.displayName).sort()).toEqual([
      'Active channel member',
      'Channel owner',
    ])
  })

  it('keeps the Channel access boundary when a Project member is not a Channel member', async () => {
    const t = convexTest(schema, modules)
    const fixture = await seedChannel(t)

    await expect(t.withIdentity({ subject: 'project-only-member' }).query(
      api.groups.listMembers,
      { groupId: fixture.groupId, userId: fixture.projectOnlyMemberId },
    )).rejects.toThrow('not_group_member')
  })
})

async function seedChannel(t: ReturnType<typeof convexTest>) {
  const now = 1
  const ownerId = await seedUser(t, 'channel-owner', 'Channel owner')
  const activeMemberId = await seedUser(t, 'active-channel-member', 'Active channel member')
  const projectOnlyMemberId = await seedUser(t, 'project-only-member', 'Project-only member')
  const removedMemberId = await seedUser(t, 'removed-channel-member', 'Removed channel member')
  const suspendedMemberId = await seedUser(t, 'suspended-channel-member', 'Suspended channel member')
  const archivedMemberId = await seedUser(t, 'archived-channel-member', 'Archived channel member')

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
    const memberIds = [
      ownerId,
      activeMemberId,
      projectOnlyMemberId,
      removedMemberId,
      suspendedMemberId,
      archivedMemberId,
    ]
    for (const userId of memberIds) {
      await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role: userId === ownerId ? 'owner' : 'staff',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }
    for (const [userId, status] of [
      [ownerId, 'active'],
      [activeMemberId, 'active'],
      [removedMemberId, 'removed'],
      [suspendedMemberId, 'suspended'],
      [archivedMemberId, 'archived'],
    ] as const) {
      await ctx.db.insert('groupMembers', {
        projectId,
        groupId,
        userId,
        status,
        createdAt: now,
        updatedAt: now,
      })
    }
    return { groupId, ownerId, projectOnlyMemberId }
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
