import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { anyApi } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (
  import.meta as ImportMeta & {
    glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
  }
).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../showcase-data/showcase-v1/track.json', import.meta.url)), 'utf8'))
const assetManifest = JSON.parse(readFileSync(fileURLToPath(new URL('../showcase-data/showcase-v1/track-assets.json', import.meta.url)), 'utf8'))

const identity = {
  datasetId: 'showcase-v1',
  datasetVersion: '1.0.0',
  product: 'track',
  organizationKey: 'track-native-test',
  manifestHash: 'sha256:3e3b8abf1f5f564536d4fdb6a1242795cddfa6deaf94b53c97644066f49ae3f9',
  assetManifestHash: 'sha256:998dc132963870223e798490630a33a140ba7cc6e9e950b37e10b9ccad48d7ae',
  counts: { organizations: 1, companies: 8, users: 80, projects: 20, memberships: 160, channels: 60, messages: 800, tasks: 160, suggestions: 30, attachments: 60 },
  assetCount: 61,
}

describe('Track showcase adapter', () => {
  it('rejects a checksum mutation before opening the write gate', async () => {
    const t = convexTest(schema, modules)
    const ownerUserId = await seedOwner(t)
    const organization = await t.mutation(anyApi.showcaseDataset.createOrganization, {
      datasetId: identity.datasetId,
      datasetVersion: identity.datasetVersion,
      product: identity.product,
      organizationKey: identity.organizationKey,
      displayName: 'Checksum Test',
      ownerUserId,
      companyHandles: ['checksum-company'],
    })

    await expect(t.mutation(anyApi.showcaseDataset.begin, {
      ...identity,
      organizationId: organization.organizationId,
      manifestHash: 'sha256:bad',
      assetManifestHash: 'sha256:bad',
      counts: {},
      assetCount: 0,
      ownerUserId,
    })).rejects.toThrow('checksum mismatch')

    expect((await t.run(async (ctx) => await ctx.db.query('showcaseDatasets').first()))?.status).toBe('planned')
  })

  it('applies, verifies, retries, and removes the frozen native graph', async () => {
    const t = convexTest(schema, modules)
    const ownerUserId = await seedOwner(t)
    const organization = await t.mutation(anyApi.showcaseDataset.createOrganization, {
      datasetId: identity.datasetId,
      datasetVersion: identity.datasetVersion,
      product: identity.product,
      organizationKey: identity.organizationKey,
      displayName: manifest.records.organizations[0].displayName,
      ownerUserId,
      companyHandles: manifest.records.companies.map((company: Record<string, string>) => company.externalKey.replace('track-company-', '')),
    })
    await applyGraph(t, organization.organizationId, ownerUserId)

    const firstVerification = await verifyGraph(t, organization.organizationId)
    expect(firstVerification.ok).toBe(true)
    expect(firstVerification.counts).toMatchObject({ organization: 1, companies: 8, users: 80, projects: 20, memberships: 160, channels: 60, messages: 800, tasks: 160, suggestions: 30, attachments: 60 })
    expect(firstVerification.assetCount).toBe(61)
    const nativeState = await t.run(async (ctx) => ({
      ownerMemberships: await ctx.db.query('companyMembers').withIndex('by_user_status', (q) => q.eq('userId', ownerUserId).eq('status', 'active')).collect(),
      projectMemberships: await ctx.db.query('projectMembers').collect(),
      channels: await ctx.db.query('groups').collect(),
    }))
    expect(nativeState.ownerMemberships.some((membership) => membership.role === 'owner')).toBe(true)
    const presenterProjectKeys = new Set(manifest.targetedPacks.map((pack: { projectKey: string }) => pack.projectKey))
    const presenterMembershipKeys = manifest.records.memberships
      .filter((membership: { permission: string; projectKey: string }) => membership.permission === 'manage' && presenterProjectKeys.has(membership.projectKey))
      .map((membership: { externalKey: string }) => membership.externalKey)
    const presenterMembershipRecords = await t.run(async (ctx) => await ctx.db
      .query('showcaseDatasetRecords')
      .withIndex('by_dataset_organization_type', (q) => q.eq('datasetId', identity.datasetId).eq('organizationId', organization.organizationId).eq('recordType', 'memberships'))
      .collect())
    const presenterMembershipIds = new Set(presenterMembershipRecords
      .filter((record) => presenterMembershipKeys.includes(record.externalKey))
      .map((record) => record.recordId))
    const presenterMemberships = nativeState.projectMemberships.filter((membership) =>
      presenterMembershipIds.has(String(membership._id)),
    )
    expect(presenterMemberships).toHaveLength(5)
    expect(presenterMemberships.every((membership) => membership.userId === ownerUserId)).toBe(true)
    expect(presenterMembershipIds.size).toBe(5)
    expect(nativeState.channels.every((channel) => channel.nextChannelSequence === undefined)).toBe(true)

    await t.mutation(anyApi.showcaseDataset.begin, { ...identity, organizationId: organization.organizationId, ownerUserId })
    await applyGraphRecords(t, organization.organizationId)
    const retryVerification = await verifyGraph(t, organization.organizationId)
    expect(retryVerification.ok).toBe(true)
    expect(retryVerification.counts).toEqual(firstVerification.counts)

    await t.mutation(anyApi.showcaseDataset.beginRemove, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
    })
    await expect(t.mutation(anyApi.showcaseDataset.begin, {
      ...identity,
      organizationId: organization.organizationId,
      ownerUserId,
    })).rejects.toThrow('cannot be reapplied')
    const removalOrder = ['attachments', 'suggestions', 'tasks', 'messages', 'channels', 'memberships', 'taskWorkflowStates', 'taskBoards', 'projectCompanies', 'projects', 'companyMembers', 'companies', 'users', 'showcaseDatasetAssets', 'organization']
    for (const recordType of removalOrder) {
      while (true) {
        const result = await t.mutation(anyApi.showcaseDataset.removeBatch, {
          datasetId: identity.datasetId,
          organizationKey: identity.organizationKey,
          organizationId: organization.organizationId,
          confirmOrganizationId: organization.organizationId,
          recordType,
          limit: 50,
        })
        if (result.remaining === 0) break
      }
    }
    const removed = await t.mutation(anyApi.showcaseDataset.finishRemove, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
    })
    expect(removed.status).toBe('removed')
    expect(await t.run(async (ctx) => await ctx.db.query('showcaseDatasets').collect())).toHaveLength(0)
    expect(await t.run(async (ctx) => await ctx.db.query('companies').collect())).toHaveLength(0)
  }, 120_000)
})

async function seedOwner(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => await ctx.db.insert('users', {
    authUserId: 'showcase-test-owner',
    googleSubject: 'showcase-test-owner',
    normalizedEmail: 'showcase-test-owner@track.test',
    email: 'showcase-test-owner@track.test',
    displayName: 'Showcase test owner',
    profileDesignation: 'Developer',
    twoFactorEnabled: false,
    createdAt: 1,
    updatedAt: 1,
  }))
}

async function applyGraph(t: ReturnType<typeof convexTest>, organizationId: string, ownerUserId: Id<'users'>) {
  await t.mutation(anyApi.showcaseDataset.begin, { ...identity, organizationId, ownerUserId })
  const assetIds = await t.run(async (ctx) => {
    const ids: Array<Id<'_storage'>> = []
    for (let index = 0; index < assetManifest.assets.length; index += 1) ids.push(await ctx.storage.store(new Blob([`asset-${index}`])))
    return ids
  })
  await t.mutation(anyApi.showcaseDataset.applyAssets, {
    datasetId: identity.datasetId,
    datasetVersion: identity.datasetVersion,
    organizationKey: identity.organizationKey,
    organizationId,
    assets: assetManifest.assets,
    storageIds: assetIds,
  })
  await applyGraphRecords(t, organizationId)
}

async function applyGraphRecords(t: ReturnType<typeof convexTest>, organizationId: string) {
  const recordTypes = ['organizations', 'companies', 'users', 'projects', 'memberships', 'channels', 'messages', 'tasks', 'suggestions', 'attachments']
  for (const recordType of recordTypes) {
    const values = recordType === 'memberships'
      ? manifest.records.memberships.map((record: Record<string, unknown>) => ({
          ...record,
          companyKey: manifest.records.users.find((user: Record<string, unknown>) => user.externalKey === record.userKey)?.companyKey,
        }))
      : manifest.records[recordType]
    const batchSize = ['memberships', 'messages', 'tasks'].includes(recordType) ? 25 : 20
    for (let offset = 0; offset < values.length; offset += batchSize) {
      await t.mutation(anyApi.showcaseDataset.applyBatch, {
        datasetId: identity.datasetId,
        datasetVersion: identity.datasetVersion,
        organizationKey: identity.organizationKey,
        organizationId,
        recordType,
        records: values.slice(offset, offset + batchSize),
      })
    }
  }
  await t.mutation(anyApi.showcaseDataset.finalize, {
    datasetId: identity.datasetId,
    organizationKey: identity.organizationKey,
    organizationId,
  })
}

async function verifyGraph(t: ReturnType<typeof convexTest>, organizationId: string) {
  return await t.query(anyApi.showcaseDataset.verify, {
    datasetId: identity.datasetId,
    organizationKey: identity.organizationKey,
    organizationId,
    manifestHash: identity.manifestHash,
    assetManifestHash: identity.assetManifestHash,
    assetCount: identity.assetCount,
  })
}
