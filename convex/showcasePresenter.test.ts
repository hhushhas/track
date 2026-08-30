import betterAuthTest from '@convex-dev/better-auth/test'
import { anyApi } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { components } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

const presenterEmail = 'shasanshoaib+track-showcase@gmail.com'
const organizationKey = 'track-showcase-v1-oort-20260830-dev'
const organizationId = 'track-presenter-binding-test-organization'

describe('showcase presenter reconciliation', () => {
  it('links a previous presenter account to the seeded owner without changing its starter project', async () => {
    const t = convexTest(schema, modules)
    betterAuthTest.register(t)

    const authUser = await t.run(async (ctx) => await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          email: presenterEmail,
          emailVerified: false,
          name: 'Track Showcase Presenter',
          twoFactorEnabled: false,
          createdAt: 5,
          updatedAt: 5,
        },
      },
    }))
    const native = await t.run(async (ctx) => {
      const ownerUserId = await ctx.db.insert('users', {
        googleSubject: 'showcase-owner-before-auth-bind',
        normalizedEmail: presenterEmail,
        email: presenterEmail,
        displayName: 'Track Showcase Presenter',
        profileDesignation: 'Company Owner',
        twoFactorEnabled: false,
        createdAt: 1,
        updatedAt: 1,
      })
      const starterUserId = await ctx.db.insert('users', {
        googleSubject: String(authUser._id),
        authUserId: String(authUser._id),
        normalizedEmail: presenterEmail,
        email: presenterEmail,
        displayName: 'Track Showcase Presenter',
        profileDesignation: 'Company Owner',
        twoFactorEnabled: false,
        createdAt: 2,
        updatedAt: 2,
      })
      const projectId = await ctx.db.insert('projects', {
        name: 'Default',
        clientLabel: 'Internal product build',
        accessProfile: 'legacy',
        origin: 'single_company',
        status: 'active',
        participantRevision: 0,
        revision: 1,
        createdBy: starterUserId,
        createdAt: 3,
        updatedAt: 3,
      })
      const projectMemberId = await ctx.db.insert('projectMembers', {
        projectId,
        userId: starterUserId,
        role: 'owner',
        status: 'active',
        term: 1,
        createdAt: 3,
        updatedAt: 3,
      })
      const datasetDocumentId = await ctx.db.insert('showcaseDatasets', {
        datasetId: 'showcase-v1',
        datasetVersion: '1.0.0',
        product: 'track',
        organizationKey,
        organizationId,
        status: 'applied',
        counts: {},
        assetCount: 0,
        manifestHash: 'manifest',
        assetManifestHash: 'assets',
        ownerUserId,
        createdAt: 4,
        updatedAt: 4,
      })
      await ctx.db.insert('showcaseDatasetRecords', {
        datasetId: 'showcase-v1',
        datasetVersion: '1.0.0',
        product: 'track',
        organizationKey,
        organizationId,
        recordType: 'users',
        externalKey: 'track-user-person-layan-kawthar-khoury',
        recordId: String(ownerUserId),
        owned: false,
        createdAt: 4,
      })
      return { datasetDocumentId, ownerUserId, projectId, projectMemberId, starterUserId }
    })

    const session = await t.run(async (ctx) => await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          expiresAt: Date.now() + 60_000,
          token: 'showcase-presenter-session',
          createdAt: 6,
          updatedAt: 6,
          userId: String(authUser._id),
        },
      },
    }))
    const before = await t.run(async (ctx) => ({
      project: await ctx.db.get(native.projectId),
      projectMember: await ctx.db.get(native.projectMemberId),
      starterUser: await ctx.db.get(native.starterUserId),
    }))

    const reconcile = await t.mutation(anyApi.showcaseDataset.reconcilePresenter, {
      datasetId: 'showcase-v1',
      datasetVersion: '1.0.0',
      product: 'track',
      organizationKey,
      organizationId,
      presenterEmail,
    })

    expect(reconcile).toMatchObject({
      authUserId: String(authUser._id),
      detachedUserIds: [native.starterUserId],
      targetChanged: true,
      targetUserId: native.ownerUserId,
    })
    await expect(t.withIdentity({
      subject: String(authUser._id),
      sessionId: String(session._id),
    }).query(anyApi.auth.getCurrentUser, {})).resolves.toMatchObject({
      _id: native.ownerUserId,
      authUserId: String(authUser._id),
    })

    const secondReconcile = await t.mutation(anyApi.showcaseDataset.reconcilePresenter, {
      datasetId: 'showcase-v1',
      datasetVersion: '1.0.0',
      product: 'track',
      organizationKey,
      organizationId,
      presenterEmail,
    })
    expect(secondReconcile).toMatchObject({ targetChanged: false, detachedUserIds: [] })

    const after = await t.run(async (ctx) => ({
      owner: await ctx.db.get(native.ownerUserId),
      project: await ctx.db.get(native.projectId),
      projectMember: await ctx.db.get(native.projectMemberId),
      starterUser: await ctx.db.get(native.starterUserId),
      dataset: await ctx.db.get(native.datasetDocumentId),
    }))
    expect(after.owner).toMatchObject({
      authUserId: String(authUser._id),
      googleSubject: String(authUser._id),
      normalizedEmail: presenterEmail,
    })
    expect(after.starterUser?.authUserId).toBeUndefined()
    expect(after.starterUser?.googleSubject).toBe(`showcase-detached:showcase-v1:${organizationKey}:${native.starterUserId}`)
    expect(after.project).toEqual(before.project)
    expect(after.projectMember).toEqual(before.projectMember)
    expect(after.starterUser).toMatchObject({
      displayName: before.starterUser?.displayName,
      email: before.starterUser?.email,
      profileDesignation: before.starterUser?.profileDesignation,
      twoFactorEnabled: before.starterUser?.twoFactorEnabled,
    })
    expect(after.dataset).toMatchObject({ ownerUserId: native.ownerUserId, status: 'applied' })
  })
})
