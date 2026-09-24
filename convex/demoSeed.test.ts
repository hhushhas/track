import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'

import { internal } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('demo seed', () => {
  it('creates a legacy workspace supported by web and mobile surfaces', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', {
      authUserId: 'demo-auth-user',
      googleSubject: 'demo-auth-user',
      normalizedEmail: 'developer@track.local',
      email: 'developer@track.local',
      displayName: 'Track Developer',
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    }))

    const seeded = await t.mutation(internal.demoSeed.seed, {
      email: 'developer@track.local',
    })
    const result = await t.run(async (ctx) => {
      const project = await ctx.db.get(seeded.projectId)
      const member = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', seeded.projectId).eq('userId', userId),
      ).unique()
      return { project, member }
    })

    expect(result.project?.accessProfile).toBe('legacy')
    expect(result.member?.role).toBe('owner')
  })
})
