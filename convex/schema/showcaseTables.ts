import { defineTable } from 'convex/server'
import { v } from 'convex/values'

const showcaseDatasetStatus = v.union(
  v.literal('planned'),
  v.literal('applying'),
  v.literal('applied'),
  v.literal('removing'),
  v.literal('removed'),
)

export const showcaseTables = {
  showcaseDatasets: defineTable({
    datasetId: v.string(),
    datasetVersion: v.string(),
    product: v.string(),
    organizationKey: v.string(),
    organizationId: v.string(),
    status: showcaseDatasetStatus,
    counts: v.any(),
    assetCount: v.number(),
    manifestHash: v.string(),
    assetManifestHash: v.string(),
    ownerUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization_key', ['organizationKey'])
    .index('by_dataset_organization', ['datasetId', 'organizationId'])
    .index('by_organization', ['organizationId']),

  showcaseDatasetRecords: defineTable({
    datasetId: v.string(),
    datasetVersion: v.string(),
    product: v.string(),
    organizationKey: v.string(),
    organizationId: v.string(),
    recordType: v.string(),
    externalKey: v.string(),
    recordId: v.string(),
    owned: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_dataset_organization_external', [
      'datasetId',
      'organizationId',
      'externalKey',
    ])
    .index('by_dataset_organization_type', [
      'datasetId',
      'organizationId',
      'recordType',
    ])
    .index('by_dataset_organization', ['datasetId', 'organizationId'])
    .index('by_organization', ['organizationId']),

  showcaseDatasetAssets: defineTable({
    datasetId: v.string(),
    datasetVersion: v.string(),
    product: v.string(),
    organizationKey: v.string(),
    organizationId: v.string(),
    assetKey: v.string(),
    contentHash: v.string(),
    storageKey: v.string(),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    fileSize: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_dataset_organization_asset', [
      'datasetId',
      'organizationId',
      'assetKey',
    ])
    .index('by_organization', ['organizationId']),
} as const
