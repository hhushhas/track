import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

const originalDevAuthBypass = process.env.DEV_AUTH_BYPASS
const originalSiteUrl = process.env.SITE_URL
const originalBetterAuthUrl = process.env.BETTER_AUTH_URL

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

beforeEach(() => {
  delete process.env.DEV_AUTH_BYPASS
  delete process.env.SITE_URL
  delete process.env.BETTER_AUTH_URL
})

afterEach(() => {
  restoreEnvironmentVariable('DEV_AUTH_BYPASS', originalDevAuthBypass)
  restoreEnvironmentVariable('SITE_URL', originalSiteUrl)
  restoreEnvironmentVariable('BETTER_AUTH_URL', originalBetterAuthUrl)
})

describe('development auth bypass', () => {
  it('keeps the bypass disabled unless explicitly configured for loopback development', async () => {
    const t = convexTest(schema, modules)

    await expect(t.mutation(api.auth.syncDevUser, {})).rejects.toThrow(
      'dev_auth_bypass_disabled',
    )
    process.env.DEV_AUTH_BYPASS = '1'

    await expect(t.mutation(api.auth.syncDevUser, {})).rejects.toThrow(
      'dev_auth_bypass_disabled',
    )
    process.env.SITE_URL = 'https://track.q9labs.ai'

    await expect(t.mutation(api.auth.syncDevUser, {})).rejects.toThrow(
      'dev_auth_bypass_disabled',
    )
  })

  it('binds the demo identity and never substitutes it for another authenticated user', async () => {
    process.env.DEV_AUTH_BYPASS = '1'
    process.env.SITE_URL = 'http://localhost:3000'
    const t = convexTest(schema, modules)
    const authenticated = t.withIdentity({
      subject: 'demo-auth-user',
      email: 'developer@track.local',
    })

    await expect(t.mutation(api.auth.syncDevUser, {})).rejects.toThrow(
      'dev_auth_identity_required',
    )
    const userId = await authenticated.mutation(api.auth.syncDevUser, {})

    await expect(authenticated.query(api.auth.getUser, { userId })).resolves.toMatchObject({
      _id: userId,
      authUserId: 'demo-auth-user',
      displayName: 'Track Developer',
      email: 'developer@track.local',
    })
    await expect(t.query(api.auth.getUser, { userId })).rejects.toThrow(
      'unauthenticated',
    )
    const demoUserId = await t.withIdentity({
      subject: 'demo-auth-user',
      email: 'developer@track.local',
    }).mutation(api.auth.syncDevUser, {})
    const realUserId = await t.run(async (ctx) => await ctx.db.insert('users', {
      googleSubject: 'real-user',
      authUserId: 'real-user',
      normalizedEmail: 'real-user@track.test',
      email: 'real-user@track.test',
      displayName: 'Real User',
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    }))
    const realAuthenticated = t.withIdentity({ subject: 'real-user' })

    await expect(realAuthenticated.query(api.auth.getUser, { userId: realUserId }))
      .resolves.toMatchObject({ _id: realUserId })
    await expect(realAuthenticated.query(api.auth.getUser, { userId: demoUserId }))
      .rejects.toThrow('actor_mismatch')

    await expect(t.withIdentity({
      subject: 'other-user',
      email: 'other-user@track.test',
    }).mutation(api.auth.syncDevUser, {})).rejects.toThrow(
      'dev_auth_identity_required',
    )
  })
})
