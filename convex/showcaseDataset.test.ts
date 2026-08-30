import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { anyApi } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'

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
  manifestHash: 'sha256:57533c0fc038a0ef188dac037710143ff7d9f0964bc621752001a33b199bd0a9',
  assetManifestHash: 'sha256:007e2402c550d61cdee49e0555b16a25f2f8094bdc01a3883272ebcee8479fdc',
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

  it('resumes removal from the trusted registry after the native organization marker is deleted', async () => {
    const t = convexTest(schema, modules)
    const ownerUserId = await seedOwner(t)
    const organization = await t.mutation(anyApi.showcaseDataset.createOrganization, {
      datasetId: identity.datasetId,
      datasetVersion: identity.datasetVersion,
      product: identity.product,
      organizationKey: identity.organizationKey,
      displayName: 'Removal Resume Test',
      ownerUserId,
      companyHandles: [],
    })
    await t.mutation(anyApi.showcaseDataset.begin, { ...identity, organizationId: organization.organizationId, ownerUserId })
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', {
      googleSubject: 'track-removal-resume-user',
      normalizedEmail: 'track-removal-resume@example.com',
      email: 'track-removal-resume@example.com',
      displayName: 'Removal Resume User',
      profileDesignation: 'Member',
      twoFactorEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))
    await t.run(async (ctx) => {
      await ctx.db.insert('showcaseDatasetRecords', {
        datasetId: identity.datasetId,
        datasetVersion: identity.datasetVersion,
        product: identity.product,
        organizationKey: identity.organizationKey,
        organizationId: organization.organizationId,
        recordType: 'users',
        externalKey: 'track-removal-resume-user',
        recordId: String(userId),
        owned: true,
        createdAt: Date.now(),
      })
    })
    await t.mutation(anyApi.showcaseDataset.beginRemove, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
    })
    await t.run(async (ctx) => {
      const marker = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-showcase-connected-delivery'),
      ).unique()
      if (!marker) throw new Error('test organization marker is missing')
      await ctx.db.delete(marker._id)
    })

    const staleOrganizationId = `${organization.organizationId}-native-marker-deleted`
    await expect(t.mutation(anyApi.showcaseDataset.removeBatch, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: staleOrganizationId,
      confirmOrganizationId: staleOrganizationId,
      recordType: 'users',
      limit: 50,
    })).rejects.toThrow('removal organization confirmation mismatch')
    const removedBatch = await t.mutation(anyApi.showcaseDataset.removeBatch, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
      recordType: 'users',
      limit: 50,
    })
    expect(removedBatch).toEqual({ processed: 1, remaining: 0 })
    const removed = await t.mutation(anyApi.showcaseDataset.finishRemove, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
    })
    expect(removed.status).toBe('removed')
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
    expect(firstVerification.semantic.firstLoad.populatedProjectCount).toBe(20)
    expect(firstVerification.semantic.firstLoad.projects.every((project: { firstGroup: { name: string; kind: string; groupId: string } | null; topLevelMessageCount: number }) =>
      project.firstGroup?.name === 'General' && project.topLevelMessageCount > 0,
    )).toBe(true)
    expect(firstVerification.semantic.mentions).toEqual({ messageCount: 200, linkCount: 200 })
    expect(firstVerification.semantic.threads).toMatchObject({ count: 20, replyCount: 40, invalidRelationshipCount: 0 })
    expect(firstVerification.semantic.reactions.supported).toBe(false)
    expect(firstVerification.semantic.heroes.every((hero: { firstLoad: { topLevelMessageCount: number } | null; thread: { replyCount: number; parentMentionCount: number; linkedTaskCount: number; linkedSuggestionCount: number; linkedAttachmentCount: number } }) =>
      hero.firstLoad !== null && hero.firstLoad.topLevelMessageCount > 0 &&
      hero.thread.replyCount === 2 &&
      hero.thread.parentMentionCount > 0 &&
      hero.thread.linkedTaskCount > 0 &&
      hero.thread.linkedSuggestionCount > 0 &&
      hero.thread.linkedAttachmentCount > 0,
    )).toBe(true)
    const nativeShowcaseState = await t.run(async (ctx) => {
      const [messages, attachments, suggestions] = await Promise.all([
        ctx.db.query('messages').collect(),
        ctx.db.query('attachments').collect(),
        ctx.db.query('taskSuggestions').collect(),
      ])
      const messageIds = new Set(messages.map((message) => String(message._id)))
      return {
        attachmentCount: attachments.length,
        linkedAttachmentCount: attachments.filter((attachment) =>
          messageIds.has(String(attachment.messageId)) &&
          messages.find((message) => message._id === attachment.messageId)?.attachmentIds.includes(attachment._id),
        ).length,
        suggestionStatuses: suggestions.reduce<Record<string, number>>((counts, suggestion) => ({
          ...counts,
          [suggestion.status]: (counts[suggestion.status] ?? 0) + 1,
        }), {}),
        pendingProjectCount: new Set(suggestions.filter((suggestion) => suggestion.status === 'pending').map((suggestion) => String(suggestion.projectId))).size,
        pendingDecisionMetadataCount: suggestions.filter((suggestion) => suggestion.status === 'pending' && (
          suggestion.decidedAt !== undefined ||
          suggestion.decidedByProjectMemberId !== undefined ||
          suggestion.decisionActingCompanyId !== undefined ||
          suggestion.decisionIdempotencyKey !== undefined ||
          suggestion.decidedTaskId !== undefined ||
          suggestion.dismissalReason !== undefined ||
          suggestion.duplicateOverride !== undefined
        )).length,
      }
    })
    expect(nativeShowcaseState).toEqual({
      attachmentCount: 60,
      linkedAttachmentCount: 60,
      suggestionStatuses: { accepted: 20, dismissed: 5, pending: 5 },
      pendingProjectCount: 5,
      pendingDecisionMetadataCount: 0,
    })
    const nativeContentState = await t.run(async (ctx) => {
      const [registryRecords, messages, tasks, assets, projects] = await Promise.all([
        ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization', (q) =>
          q.eq('datasetId', identity.datasetId).eq('organizationId', organization.organizationId),
        ).collect(),
        ctx.db.query('messages').collect(),
        ctx.db.query('tasks').collect(),
        ctx.db.query('showcaseDatasetAssets').withIndex('by_organization', (q) => q.eq('organizationId', organization.organizationId)).collect(),
        ctx.db.query('projects').collect(),
      ])
      const recordsByKey = new Map(registryRecords.map((record) => [record.externalKey, record]))
      const datasetMessageRecords = registryRecords.filter((record) => record.recordType === 'messages')
      const datasetTaskRecords = registryRecords.filter((record) => record.recordType === 'tasks')
      const datasetMessages = messages.filter((message) => datasetMessageRecords.some((record) => record.recordId === String(message._id)))
      const datasetTasks = tasks.filter((task) => datasetTaskRecords.some((record) => record.recordId === String(task._id)))
      const projectByKey = new Map<string, { externalKey: string; startsAt: string }>()
      for (const project of manifest.records.projects) projectByKey.set(project.externalKey, project)
      const messageByKey = new Map(datasetMessageRecords.map((record) => {
        const id = ctx.db.normalizeId('messages', record.recordId)
        return [record.externalKey, id ? messages.find((message) => message._id === id) : undefined]
      }))
      const forbidden = /Track showcase mention|Track thread follow-up|Evidence-linked task from|track-message-\d{4}/i
      const messageTextErrors = datasetMessages.filter((message) => forbidden.test(message.body)).length
      const taskTextErrors = datasetTasks.filter((task) => forbidden.test(task.description ?? '')).length
      const chronologyErrors = datasetMessages.filter((message) => {
        const messageRecord = datasetMessageRecords.find((record) => record.recordId === String(message._id))
        const source = messageRecord ? manifest.records.messages.find((record: { externalKey: string }) => record.externalKey === messageRecord.externalKey) : undefined
        const project = source ? projectByKey.get(source.projectKey) : undefined
        return !project || message.createdAt < Date.parse(project.startsAt)
      }).length
      const threadErrors = []
      for (const projectIndex of Array.from({ length: 20 }, (_, index) => index)) {
        const parentKey = `track-message-${String(projectIndex * 40 + 13).padStart(4, '0')}`
        const parent = messageByKey.get(parentKey)
        const firstReply = messageByKey.get(`track-message-${String(projectIndex * 40 + 16).padStart(4, '0')}`)
        const secondReply = messageByKey.get(`track-message-${String(projectIndex * 40 + 19).padStart(4, '0')}`)
        const token = parent?.body.replace(/\s+/g, ' ').trim().slice(0, 48).toLocaleLowerCase()
        if (!parent || !firstReply || !secondReply || !token ||
          !firstReply.body.toLocaleLowerCase().includes(token) ||
          !secondReply.body.toLocaleLowerCase().includes(token) ||
          firstReply.createdAt <= parent.createdAt || secondReply.createdAt <= firstReply.createdAt) {
          threadErrors.push(parentKey)
        }
      }
      const assetMetadataErrors = assets.filter((asset) => {
        const metadata = asset.metadata
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return true
        const body = 'body' in metadata && typeof metadata.body === 'string' ? metadata.body : ''
        return forbidden.test(body)
      }).length
      const voiceAssets = assets.filter((asset) => {
        const metadata = asset.metadata
        return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.category === 'voice-note'
      })
      const voiceTranscripts = voiceAssets.map((asset) => {
        const metadata = asset.metadata
        return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata.transcript === 'string'
          ? metadata.transcript
          : ''
      })
      return {
        messageCount: datasetMessages.length,
        taskCount: datasetTasks.length,
        messageTextErrors,
        taskTextErrors,
        chronologyErrors,
        threadErrors,
        assetMetadataErrors,
        voiceTranscriptCount: voiceTranscripts.length,
        uniqueVoiceTranscriptCount: new Set(voiceTranscripts).size,
        uniqueProjectCount: new Set(projects.map((project) => String(project._id))).size,
        registeredProjectCount: recordsByKey.size,
      }
    })
    expect(nativeContentState).toMatchObject({
      messageCount: 800,
      taskCount: 160,
      messageTextErrors: 0,
      taskTextErrors: 0,
      chronologyErrors: 0,
      threadErrors: [],
      assetMetadataErrors: 0,
      voiceTranscriptCount: 10,
      uniqueVoiceTranscriptCount: 10,
    })
    const nativeState = await t.run(async (ctx) => ({
      ownerMemberships: await ctx.db.query('companyMembers').withIndex('by_user_status', (q) => q.eq('userId', ownerUserId).eq('status', 'active')).collect(),
      projectMemberships: await ctx.db.query('projectMembers').collect(),
      channels: await ctx.db.query('groups').collect(),
      groupMemberships: await ctx.db.query('groupMembers').collect(),
      projects: await ctx.db.query('projects').collect(),
      projectCompanies: await ctx.db.query('projectCompanies').collect(),
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
    const generalChannels = nativeState.channels.filter((channel) => channel.kind === 'general')
    expect(generalChannels).toHaveLength(identity.counts.projects)
    expect(generalChannels.every((channel) => channel.name === 'General')).toBe(true)
    expect(nativeState.projectMemberships.every((membership) => nativeState.groupMemberships.some(
      (groupMembership) => groupMembership.projectMemberId === membership._id &&
        generalChannels.some((channel) => channel._id === groupMembership.groupId),
    ))).toBe(true)
    expect(nativeState.projects.every((project) => {
      const companyCount = nativeState.projectCompanies.filter((company) => company.projectId === project._id).length
      return companyCount > 1 ? project.origin === 'shared' : project.origin === 'single_company'
    })).toBe(true)

    vi.stubEnv('TRACK_COMPANY_MODEL_ENABLED', 'true')
    vi.stubEnv('TRACK_THREADS_ENABLED', 'true')
    const nativeReadPath = await t.run(async (ctx) => {
      const projectRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-project-agency-campaign'),
      ).unique()
      if (!projectRecord) throw new Error('hero project registry record is missing')
      const projectId = ctx.db.normalizeId('projects', projectRecord.recordId)
      if (!projectId) throw new Error('hero project registry id is invalid')
      const membership = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
        q.eq('projectId', projectId).eq('userId', ownerUserId),
      ).unique()
      if (!membership || !membership.companyId) throw new Error('hero owner membership is missing')
      const threadParent = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-message-0013'),
      ).unique()
      if (!threadParent) throw new Error('hero thread parent registry record is missing')
      const parentId = ctx.db.normalizeId('messages', threadParent.recordId)
      if (!parentId) throw new Error('hero thread parent id is invalid')
      const parent = await ctx.db.get(parentId)
      if (!parent) throw new Error('hero thread parent is missing')
      const threadRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', '__support:channelThread:track-message-0013'),
      ).unique()
      if (!threadRecord) throw new Error('hero thread registry record is missing')
      const threadId = ctx.db.normalizeId('channelThreads', threadRecord.recordId)
      if (!threadId) throw new Error('hero thread id is invalid')
      return {
        projectId,
        companyId: membership.companyId,
        projectMemberId: membership._id,
        threadId,
      }
    })
    const actor = t.withIdentity({ subject: 'showcase-test-owner' })
    const companyProjects = await actor.query(anyApi.sharedProjects.listForActingCompany, {
      actingCompanyId: nativeReadPath.companyId,
    })
    expect(companyProjects.some((item: { project: { _id: Id<'projects'> } }) => item.project._id === nativeReadPath.projectId)).toBe(true)
    const channels = await actor.query(anyApi.channels.list, {
      projectId: nativeReadPath.projectId,
      actingCompanyId: nativeReadPath.companyId,
      projectMemberId: nativeReadPath.projectMemberId,
    })
    expect(channels[0]?.channel.kind).toBe('general')
    const firstLoadMessages = await actor.query(anyApi.messages.listDetailed, {
      groupId: channels[0].channel._id,
      userId: ownerUserId,
      actingCompanyId: nativeReadPath.companyId,
      projectMemberId: nativeReadPath.projectMemberId,
      limit: 80,
    })
    expect(firstLoadMessages.length).toBeGreaterThan(0)
    const thread = await actor.query(anyApi.channelThreads.get, {
      threadId: nativeReadPath.threadId,
      userId: ownerUserId,
      actingCompanyId: nativeReadPath.companyId,
      projectMemberId: nativeReadPath.projectMemberId,
    })
    expect(thread?.replyCount).toBe(2)
    const threadMessages = await actor.query(anyApi.channelThreads.listMessages, {
      threadId: nativeReadPath.threadId,
      userId: ownerUserId,
      actingCompanyId: nativeReadPath.companyId,
      projectMemberId: nativeReadPath.projectMemberId,
    })
    expect(threadMessages).toHaveLength(2)
    expect(firstLoadMessages.some((message: { message: { mentions: Array<Id<'users'>> } }) => message.message.mentions.length > 0)).toBe(true)

    await t.run(async (ctx) => {
      const messageRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-message-0004'),
      ).unique()
      if (!messageRecord) throw new Error('target message registry record is missing')
      const messageId = ctx.db.normalizeId('messages', messageRecord.recordId)
      if (!messageId) throw new Error('target message registry id is invalid')
      const message = await ctx.db.get(messageId)
      if (!message) throw new Error('target message is missing')
      const staleChannel = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', message.projectId)).collect())
        .find((group) => group.kind === 'custom')
      if (!staleChannel) throw new Error('stale test channel is missing')
      await ctx.db.patch(messageId, {
        body: 'stale showcase content that must be repaired',
        groupId: staleChannel._id,
        mentions: [],
        mentionedProjectMemberIds: [],
        attachmentIds: [],
      })
      const suggestionRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-suggestion-06'),
      ).unique()
      if (!suggestionRecord) throw new Error('target suggestion registry record is missing')
      const suggestionId = ctx.db.normalizeId('taskSuggestions', suggestionRecord.recordId)
      if (!suggestionId) throw new Error('target suggestion registry id is invalid')
      await ctx.db.patch(suggestionId, {
        status: 'dismissed',
        dismissalReason: 'not_actionable',
        decisionIdempotencyKey: 'legacy-showcase-decision',
        decidedAt: Date.now(),
      })
      const voiceAssetKey = assetManifest.assets.find((asset: { category: string }) => asset.category === 'voice-note')?.assetKey
      if (!voiceAssetKey) throw new Error('voice asset fixture is missing')
      const voiceAsset = await ctx.db.query('showcaseDatasetAssets').withIndex('by_dataset_organization_asset', (q) =>
        q.eq('datasetId', identity.datasetId).eq('organizationId', organization.organizationId).eq('assetKey', voiceAssetKey),
      ).unique()
      if (!voiceAsset) throw new Error('voice asset is missing')
      const staleMetadata = voiceAsset.metadata
      if (!staleMetadata || typeof staleMetadata !== 'object' || Array.isArray(staleMetadata)) throw new Error('voice asset metadata is missing')
      await ctx.db.patch(voiceAsset._id, {
        metadata: { ...staleMetadata, transcript: 'stale voice fixture transcript' },
      })
      const legacyProjectCompany = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', '__support:projectCompany:track-project-exhibition-planning:track-company-juniper-operations'),
      ).unique()
      if (legacyProjectCompany) throw new Error('legacy project company registry key already exists')
      const currentProjectCompany = (await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_type', (q) =>
        q.eq('datasetId', identity.datasetId).eq('organizationId', organization.organizationId).eq('recordType', 'projectCompanies'),
      ).collect()).find((record) => record.externalKey.startsWith('__support:projectCompany:track-project-exhibition-planning:'))
      if (!currentProjectCompany) throw new Error('secondary project company registry record is missing')
      await ctx.db.patch(currentProjectCompany._id, {
        externalKey: '__support:projectCompany:track-project-exhibition-planning:track-company-juniper-operations',
      })
    })
    const brokenRelationVerification = await verifyGraph(t, organization.organizationId)
    expect(brokenRelationVerification.ok).toBe(false)
    expect(brokenRelationVerification.relationshipErrors).toContain('track-attachment-02 has incomplete message scope')
    await t.mutation(anyApi.showcaseDataset.begin, { ...identity, organizationId: organization.organizationId, ownerUserId })
    const existingStorageIds = await t.run(async (ctx) => {
      const assets = await ctx.db.query('showcaseDatasetAssets').withIndex('by_organization', (q) => q.eq('organizationId', organization.organizationId)).collect()
      const byKey = new Map(assets.map((asset) => [asset.assetKey, asset.storageId]))
      const ids: Array<Id<'_storage'>> = []
      for (const asset of assetManifest.assets) {
        const storageId = byKey.get(asset.assetKey)
        if (!storageId) throw new Error(`storage binding is missing for ${asset.assetKey}`)
        ids.push(storageId)
      }
      return ids
    })
    await t.mutation(anyApi.showcaseDataset.applyAssets, {
      datasetId: identity.datasetId,
      datasetVersion: identity.datasetVersion,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      assets: assetManifest.assets,
      storageIds: existingStorageIds,
    })
    await applyGraphRecords(t, organization.organizationId)
    const retryVerification = await verifyGraph(t, organization.organizationId)
    expect(retryVerification.ok, retryVerification.relationshipErrors.join('; ')).toBe(true)
    expect(retryVerification.counts).toEqual(firstVerification.counts)
    expect(retryVerification.semantic.threads).toMatchObject({ count: 20, replyCount: 40, invalidRelationshipCount: 0 })
    const repairedMessage = await t.run(async (ctx) => {
      const messageRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-message-0001'),
      ).unique()
      if (!messageRecord) throw new Error('repaired message registry record is missing')
      const messageId = ctx.db.normalizeId('messages', messageRecord.recordId)
      if (!messageId) throw new Error('repaired message registry id is invalid')
      const message = await ctx.db.get(messageId)
      if (!message) throw new Error('repaired message is missing')
      const group = await ctx.db.get(message.groupId)
      return { body: message.body, kind: group?.kind, mentionCount: message.mentions.length }
    })
    expect(repairedMessage.kind).toBe('general')
    expect(repairedMessage.body).toContain('Mosaic Campaign Launch')
    expect(repairedMessage.mentionCount).toBe(1)
    const repairedVoiceAsset = await t.run(async (ctx) => {
      const voiceAssetKey = assetManifest.assets.find((asset: { category: string }) => asset.category === 'voice-note')?.assetKey
      if (!voiceAssetKey) throw new Error('voice asset fixture is missing')
      return await ctx.db.query('showcaseDatasetAssets').withIndex('by_dataset_organization_asset', (q) =>
        q.eq('datasetId', identity.datasetId).eq('organizationId', organization.organizationId).eq('assetKey', voiceAssetKey),
      ).unique()
    })
    const expectedVoiceAsset = assetManifest.assets.find((asset: { category: string }) => asset.category === 'voice-note')
    expect(repairedVoiceAsset?.metadata?.transcript).toBe(expectedVoiceAsset?.transcript)
    expect(repairedVoiceAsset?.metadata?.speakers).toHaveLength(3)
    const repairedSuggestion = await t.run(async (ctx) => {
      const suggestionRecord = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_external', (q) =>
        q.eq('datasetId', identity.datasetId)
          .eq('organizationId', organization.organizationId)
          .eq('externalKey', 'track-suggestion-06'),
      ).unique()
      if (!suggestionRecord) throw new Error('repaired suggestion registry record is missing')
      const suggestionId = ctx.db.normalizeId('taskSuggestions', suggestionRecord.recordId)
      if (!suggestionId) throw new Error('repaired suggestion registry id is invalid')
      return await ctx.db.get(suggestionId)
    })
    expect(repairedSuggestion).toMatchObject({ status: 'pending' })
    expect(repairedSuggestion?.dismissalReason).toBeUndefined()
    expect(repairedSuggestion?.decisionIdempotencyKey).toBeUndefined()
    expect(repairedSuggestion?.decidedAt).toBeUndefined()

    const unregisteredMessageId = await t.run(async (ctx) => {
      const channel = await ctx.db.query('groups').first()
      if (!channel) throw new Error('test channel is missing')
      const membership = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', channel.projectId)).first()
      if (!membership) throw new Error('test membership is missing')
      return await ctx.db.insert('messages', {
        projectId: channel.projectId,
        groupId: channel._id,
        authorId: membership.userId,
        authorProjectMemberId: membership._id,
        actingCompanyId: membership.companyId,
        body: 'Presenter-created content must block showcase removal.',
        mentions: [],
        attachmentIds: [],
        createdAt: Date.now(),
      })
    })
    await expect(t.mutation(anyApi.showcaseDataset.beginRemove, {
      datasetId: identity.datasetId,
      organizationKey: identity.organizationKey,
      organizationId: organization.organizationId,
      confirmOrganizationId: organization.organizationId,
    })).rejects.toThrow('unregistered message')
    expect((await t.run(async (ctx) => await ctx.db.query('showcaseDatasets').first()))?.status).toBe('applied')
    await t.run(async (ctx) => await ctx.db.delete(unregisteredMessageId))

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
    const removalOrder = ['attachments', 'suggestions', 'tasks', 'channelThreads', 'messages', 'channels', 'generalChannels', 'memberships', 'taskWorkflowStates', 'taskBoards', 'projectCompanies', 'projects', 'companyMembers', 'companies', 'users', 'showcaseDatasetAssets', 'organization']
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
  }, 300_000)
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
    if (recordType === 'messages') {
      await t.mutation(anyApi.showcaseDataset.applyRelationships, {
        datasetId: identity.datasetId,
        organizationKey: identity.organizationKey,
        organizationId,
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
