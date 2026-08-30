import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { upsertThreadFollower } from './lib/channelThreadPolicy'
import { appendTaskActivity, rankForIndex } from './lib/taskData'

const DATASET_ID = 'showcase-v1'
const DATASET_VERSION = '1.0.0'
const PRODUCT = 'track'
const OWNER_USER_EXTERNAL_KEY = 'track-user-person-layan-kawthar-khoury'

const presenterProjectByUser = new Map([
  ['track-user-person-layan-kawthar-khoury', 'track-project-agency-campaign'],
  ['track-user-person-zaina-walid-alami', 'track-project-construction-coordination'],
  ['track-user-person-sami-ghassan-karam', 'track-project-software-delivery'],
  ['track-user-person-maha-saad-habib', 'track-project-exhibition-planning'],
  ['track-user-person-adel-aref-rifai', 'track-project-cross-functional-operations'],
])

function usesPresenterIdentity(userKey: string, projectKey: string) {
  return presenterProjectByUser.get(userKey) === projectKey
}
const ORGANIZATION_EXTERNAL_KEY = 'track-showcase-connected-delivery'
const MANIFEST_HASH = 'sha256:57533c0fc038a0ef188dac037710143ff7d9f0964bc621752001a33b199bd0a9'
const ASSET_MANIFEST_HASH = 'sha256:007e2402c550d61cdee49e0555b16a25f2f8094bdc01a3883272ebcee8479fdc'

const expectedCounts = Object.freeze({
  organizations: 1,
  companies: 8,
  users: 80,
  projects: 20,
  memberships: 160,
  channels: 60,
  messages: 800,
  tasks: 160,
  suggestions: 30,
  attachments: 60,
})

const relationshipCounts = Object.freeze({
  channelThreads: 20,
  threadReplies: 40,
  mentionMessages: 200,
})

const DEFAULT_SCOPE_MESSAGE_COUNT = 6
const THREAD_PARENT_LOCAL_INDEX = 12
const THREAD_REPLY_LOCAL_INDICES = new Set([15, 18])

function hasExpectedCounts(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const expectedKeys = Object.keys(expectedCounts)
  const actual = new Map(Object.entries(value))
  return actual.size === expectedKeys.length && Object.entries(expectedCounts).every(([key, count]) => actual.get(key) === count)
}

const manifestRecordTypes = Object.freeze([
  'organization',
  'companies',
  'users',
  'projects',
  'memberships',
  'channels',
  'messages',
  'tasks',
  'suggestions',
  'attachments',
] as const)

type ManifestRecordType = (typeof manifestRecordTypes)[number]
type RegistryRecord = Doc<'showcaseDatasetRecords'>
type ShowcaseRecord = Record<string, unknown>

const recordTypeValidator = v.union(
  v.literal('organizations'),
  v.literal('companies'),
  v.literal('users'),
  v.literal('projects'),
  v.literal('memberships'),
  v.literal('channels'),
  v.literal('messages'),
  v.literal('tasks'),
  v.literal('suggestions'),
  v.literal('attachments'),
)

const removalTypeValidator = v.union(
  v.literal('organization'),
  v.literal('companies'),
  v.literal('users'),
  v.literal('projects'),
  v.literal('memberships'),
  v.literal('channels'),
  v.literal('messages'),
  v.literal('tasks'),
  v.literal('suggestions'),
  v.literal('attachments'),
  v.literal('channelThreads'),
  v.literal('companyMembers'),
  v.literal('projectCompanies'),
  v.literal('taskBoards'),
  v.literal('taskWorkflowStates'),
  v.literal('generalChannels'),
  v.literal('showcaseDatasetAssets'),
)

type NativeTable =
  | 'companies'
  | 'users'
  | 'projects'
  | 'projectMembers'
  | 'groups'
  | 'messages'
  | 'tasks'
  | 'taskSuggestions'
  | 'attachments'
  | 'companyMembers'
  | 'projectCompanies'
  | 'taskBoards'
  | 'taskWorkflowStates'
  | 'showcaseDatasetAssets'
  | 'channelThreads'

type ReadCtx = QueryCtx | MutationCtx
type WriteCtx = MutationCtx

function recordObject(value: unknown, label: string): ShowcaseRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return Object.fromEntries(Object.entries(value))
}

function requiredString(record: ShowcaseRecord, field: string) {
  const value = record[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value
}

function optionalString(record: ShowcaseRecord, field: string) {
  const value = record[field]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  return value
}

function requiredNumber(record: ShowcaseRecord, field: string) {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`)
  }
  return value
}

function arrayField(record: ShowcaseRecord, field: string) {
  const value = record[field]
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return value
}

function parseDate(record: ShowcaseRecord, field: string) {
  const value = requiredString(record, field)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${field} is not a valid date`)
  return timestamp
}

function companyHandle(externalKey: string) {
  return externalKey.replace(/^track-company-/, '')
}

function datasetByOrganization(ctx: ReadCtx, organizationId: string) {
  return ctx.db
    .query('showcaseDatasets')
    .withIndex('by_dataset_organization', (q) =>
      q.eq('datasetId', DATASET_ID).eq('organizationId', organizationId),
    )
    .unique()
}

function datasetByKey(ctx: ReadCtx, organizationKey: string) {
  return ctx.db
    .query('showcaseDatasets')
    .withIndex('by_organization_key', (q) => q.eq('organizationKey', organizationKey))
    .filter((q) => q.eq(q.field('datasetId'), DATASET_ID))
    .unique()
}

async function requireDataset(
  ctx: ReadCtx,
  organizationId: string,
  organizationKey: string,
  expectedStatus?: Doc<'showcaseDatasets'>['status'],
) {
  const dataset = await datasetByOrganization(ctx, organizationId)
  if (
    !dataset ||
    dataset.organizationKey !== organizationKey ||
    dataset.product !== PRODUCT ||
    dataset.datasetVersion !== DATASET_VERSION
  ) {
    throw new Error('showcase organization is not owned by Track showcase-v1')
  }
  if (expectedStatus && dataset.status !== expectedStatus) {
    throw new Error(`showcase dataset must be ${expectedStatus}`)
  }
  return dataset
}

async function requireRemovingDataset(ctx: ReadCtx, organizationKey: string, organizationId: string) {
  const dataset = await datasetByKey(ctx, organizationKey)
  if (
    !dataset ||
    dataset.product !== PRODUCT ||
    dataset.datasetVersion !== DATASET_VERSION ||
    dataset.status !== 'removing'
  ) {
    throw new Error('showcase dataset removal is not active for Track showcase-v1')
  }
  if (dataset.organizationId !== organizationId) throw new Error('removal organization confirmation mismatch')
  return dataset
}

async function registryRecord(
  ctx: ReadCtx,
  organizationId: string,
  externalKey: string,
) {
  return await ctx.db
    .query('showcaseDatasetRecords')
    .withIndex('by_dataset_organization_external', (q) =>
      q.eq('datasetId', DATASET_ID)
        .eq('organizationId', organizationId)
        .eq('externalKey', externalKey),
    )
    .unique()
}

async function registerRecord(
  ctx: WriteCtx,
  input: {
    dataset: Doc<'showcaseDatasets'>
    recordType: string
    externalKey: string
    recordId: string
    owned: boolean
  },
) {
  const existing = await registryRecord(ctx, input.dataset.organizationId, input.externalKey)
  if (existing) {
    if (
      existing.recordType !== input.recordType ||
      existing.recordId !== input.recordId ||
      existing.owned !== input.owned
    ) {
      throw new Error(`external key ${input.externalKey} is already bound to another record`)
    }
    return existing
  }
  const id = await ctx.db.insert('showcaseDatasetRecords', {
    datasetId: input.dataset.datasetId,
    datasetVersion: input.dataset.datasetVersion,
    product: input.dataset.product,
    organizationKey: input.dataset.organizationKey,
    organizationId: input.dataset.organizationId,
    recordType: input.recordType,
    externalKey: input.externalKey,
    recordId: input.recordId,
    owned: input.owned,
    createdAt: Date.now(),
  })
  return await ctx.db.get(id)
}

async function requireRegistryId<T extends NativeTable>(
  ctx: ReadCtx,
  organizationId: string,
  externalKey: string,
  recordType: string,
  table: T,
) {
  const record = await registryRecord(ctx, organizationId, externalKey)
  if (!record || record.recordType !== recordType) {
    throw new Error(`missing ${recordType} parent ${externalKey}`)
  }
  const id = ctx.db.normalizeId(table, record.recordId)
  if (!id) throw new Error(`invalid ${table} id for ${externalKey}`)
  const document = await ctx.db.get(id)
  if (!document) throw new Error(`missing native parent ${externalKey}`)
  return id
}

async function ownerUserId(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>) {
  if (!dataset.ownerUserId) throw new Error('showcase owner user is required')
  const owner = await ctx.db.get(dataset.ownerUserId)
  if (!owner) throw new Error('showcase owner user does not exist')
  return owner._id
}

async function userForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'users', 'users')
}

async function userForProjectKey(
  ctx: ReadCtx,
  dataset: Doc<'showcaseDatasets'>,
  userKey: string,
  projectKey: string,
) {
  if (usesPresenterIdentity(userKey, projectKey)) return await ownerUserId(ctx, dataset)
  return await userForKey(ctx, dataset, userKey)
}

async function projectForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'projects', 'projects')
}

async function companyForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'companies', 'companies')
}

async function channelForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'channels', 'groups')
}

async function messageForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'messages', 'messages')
}

async function taskForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  return await requireRegistryId(ctx, dataset.organizationId, externalKey, 'tasks', 'tasks')
}

async function assetForKey(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, externalKey: string) {
  const asset = await ctx.db
    .query('showcaseDatasetAssets')
    .withIndex('by_dataset_organization_asset', (q) =>
      q.eq('datasetId', DATASET_ID)
        .eq('organizationId', dataset.organizationId)
        .eq('assetKey', externalKey),
    )
    .unique()
  if (!asset) throw new Error(`missing uploaded asset ${externalKey}`)
  return asset
}

function projectRole(permission: string) {
  if (permission === 'manage') return 'manager' as const
  return 'member' as const
}

function companyRole(role: string) {
  if (role === 'owner') return 'owner' as const
  if (role === 'project-manager') return 'admin' as const
  return 'member' as const
}

function taskStateCategory(state: string) {
  if (state === 'done') return 'completed' as const
  if (state === 'blocked') return 'backlog' as const
  if (state === 'in_progress') return 'started' as const
  return 'unstarted' as const
}

function taskPriority(index: number) {
  return ['high', 'medium', 'low', 'urgent', 'none'][index % 5] as
    | 'high'
    | 'medium'
    | 'low'
    | 'urgent'
    | 'none'
}

function messageNumber(externalKey: string) {
  const number = Number(externalKey.replace('track-message-', ''))
  if (!Number.isInteger(number) || number < 1 || number > expectedCounts.messages) {
    throw new Error(`invalid Track message key ${externalKey}`)
  }
  return number
}

function messageLocalIndex(externalKey: string) {
  return (messageNumber(externalKey) - 1) % 40
}

function isDefaultScopeMessage(externalKey: string) {
  return messageLocalIndex(externalKey) < DEFAULT_SCOPE_MESSAGE_COUNT
}

function messageSequence(externalKey: string) {
  const localIndex = messageLocalIndex(externalKey)
  return localIndex < DEFAULT_SCOPE_MESSAGE_COUNT
    ? localIndex + 1
    : Math.floor(localIndex / 3) + 1
}

function threadKey(projectKey: string) {
  return `__support:channelThread:${projectKey}`
}

function threadRole(externalKey: string) {
  const localIndex = messageLocalIndex(externalKey)
  if (localIndex === THREAD_PARENT_LOCAL_INDEX) return 'parent' as const
  if (THREAD_REPLY_LOCAL_INDICES.has(localIndex)) return 'reply' as const
  return null
}

function mentionHandle(displayName: string) {
  return displayName.toLowerCase().replace(/[^a-z0-9._-]+/g, '')
}

function sourceNarrative(body: string) {
  return body
    .split('\n\n')[0]
    .replace(/[.!?。؟]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mentionPrompt(locale: string | undefined, displayName: string) {
  const handle = `@${mentionHandle(displayName)}`
  if (locale === 'ar-SA') return `${handle}، هل يمكنك تأكيد التسليم التالي؟`
  if (locale === 'ar-en') return `${handle}، please confirm the next handoff.`
  return `${handle}, please confirm the next handoff.`
}

const englishThreadReplyTemplates: Array<{ first: (narrative: string) => string; second: (narrative: string) => string }> = [
  {
    first: (narrative) => `I reviewed the same work item: ${narrative}. I will confirm the owner at the next checkpoint.`,
    second: (narrative) => `The handoff stays on the same work item: ${narrative}. I will attach the supporting artifact before closure.`,
  },
  {
    first: (narrative) => `Keeping this thread on the same item: ${narrative}. I will post the due-date check after the owner responds.`,
    second: (narrative) => `I am passing the same item to the receiving team: ${narrative}. The evidence will remain with the handoff record.`,
  },
  {
    first: (narrative) => `The evidence still points to this work item: ${narrative}. I will link the next review outcome here.`,
    second: (narrative) => `The next step follows this same work item: ${narrative}. The receiving team will confirm acceptance at the checkpoint.`,
  },
  {
    first: (narrative) => `There is no scope change for this work item: ${narrative}. The owner will close the remaining action in this thread.`,
    second: (narrative) => `I will close the follow-up on this same item: ${narrative}. The proof link will stay in this thread for review.`,
  },
  {
    first: (narrative) => `Carrying forward the same update: ${narrative}. I will attach the review note before the next checkpoint.`,
    second: (narrative) => `The receiving team is aligned on the same update: ${narrative}. I will report the completed handoff after verification.`,
  },
]

const arabicThreadReplyTemplates: Array<{ first: (narrative: string) => string; second: (narrative: string) => string }> = [
  {
    first: (narrative) => `راجعت بند العمل نفسه: ${narrative}. سأؤكد المسؤول في موعد المراجعة التالي.`,
    second: (narrative) => `يبقى التسليم مرتبطًا ببند العمل نفسه: ${narrative}. سأرفق المستند الداعم قبل الإغلاق.`,
  },
  {
    first: (narrative) => `نبقي هذا الخيط مرتبطًا بالبند نفسه: ${narrative}. سأضيف فحص الموعد بعد رد المسؤول.`,
    second: (narrative) => `سأمرر البند نفسه إلى الفريق المستلم: ${narrative}. وسأحفظ الدليل مع سجل التسليم.`,
  },
  {
    first: (narrative) => `ما زال الدليل مرتبطًا ببند العمل نفسه: ${narrative}. سأربط نتيجة المراجعة التالية هنا.`,
    second: (narrative) => `تتطابق الخطوة التالية مع هذا البند: ${narrative}. سيؤكد الفريق الاستلام في الموعد المحدد.`,
  },
  {
    first: (narrative) => `لا يوجد تغيير في نطاق بند العمل: ${narrative}. سيغلق المسؤول الإجراء المتبقي في هذا الخيط.`,
    second: (narrative) => `سأغلق المتابعة على البند نفسه: ${narrative}. وسيبقى رابط الإثبات في هذا الخيط.`,
  },
  {
    first: (narrative) => `نواصل التحديث نفسه: ${narrative}. سأرفق ملاحظة المراجعة قبل نقطة التحقق التالية.`,
    second: (narrative) => `الفريق المستلم متفق على التحديث نفسه: ${narrative}. سأبلغ عن اكتمال التسليم بعد التحقق.`,
  },
]

function threadReplyBody(parentBody: string, projectOffset: number, replyIndex: number) {
  const narrative = sourceNarrative(parentBody)
  const templates = /[\u0600-\u06FF]/u.test(parentBody) ? arabicThreadReplyTemplates : englishThreadReplyTemplates
  const template = templates[projectOffset % templates.length]
  return replyIndex === 0 ? template.first(narrative) : template.second(narrative)
}

function isShowcaseOwned(record: RegistryRecord) {
  if (!record.owned) throw new Error(`refusing to mutate non-showcase record ${record.externalKey}`)
  return record
}

async function generalChannelForProject(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  projectKey: string,
  projectId: Id<'projects'>,
) {
  const supportKey = `__support:generalChannel:${projectKey}`
  const support = await registryRecord(ctx, dataset.organizationId, supportKey)
  if (support) {
    const id = ctx.db.normalizeId('groups', support.recordId)
    if (!id) throw new Error(`invalid General channel registry id ${projectKey}`)
    const channel = await ctx.db.get(id)
    if (!channel || channel.projectId !== projectId || channel.kind !== 'general') {
      throw new Error(`General channel scope mismatch ${projectKey}`)
    }
    return channel
  }
  const channels = (await ctx.db
    .query('groups')
    .withIndex('by_project', (q) => q.eq('projectId', projectId))
    .collect())
    .filter((channel) => channel.kind === 'general')
  if (channels.length === 0) {
    const creator = await ownerUserId(ctx, dataset)
    const now = Date.now()
    const generalId = await ctx.db.insert('groups', {
      projectId,
      kind: 'general',
      name: 'General',
      status: 'active',
      revision: 1,
      createdBy: creator,
      createdAt: now,
      updatedAt: now,
    })
    await registerRecord(ctx, {
      dataset,
      recordType: 'generalChannels',
      externalKey: supportKey,
      recordId: String(generalId),
      owned: true,
    })
    const general = await ctx.db.get(generalId)
    if (!general) throw new Error(`General channel creation failed for ${projectKey}`)
    return general
  }
  if (channels.length !== 1) throw new Error(`expected one General channel for ${projectKey}`)
  await registerRecord(ctx, {
    dataset,
    recordType: 'generalChannels',
    externalKey: supportKey,
    recordId: String(channels[0]._id),
    owned: false,
  })
  return channels[0]
}

async function ensureGroupMember(
  ctx: WriteCtx,
  input: {
    projectId: Id<'projects'>
    groupId: Id<'groups'>
    userId: Id<'users'>
    projectMemberId: Id<'projectMembers'>
    isSteward: boolean
  },
) {
  const existing = await ctx.db
    .query('groupMembers')
    .withIndex('by_group_project_member', (q) =>
      q.eq('groupId', input.groupId).eq('projectMemberId', input.projectMemberId),
    )
    .unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, {
      projectId: input.projectId,
      userId: input.userId,
      status: 'active',
      isSteward: input.isSteward,
      updatedAt: now,
    })
    return existing._id
  }
  return await ctx.db.insert('groupMembers', {
    projectId: input.projectId,
    groupId: input.groupId,
    userId: input.userId,
    projectMemberId: input.projectMemberId,
    status: 'active',
    isSteward: input.isSteward,
    createdAt: now,
    updatedAt: now,
  })
}

async function projectCompanyForProject(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  projectKey: string,
  projectId: Id<'projects'>,
  companyId: Id<'companies'>,
  companyKey: string,
) {
  const primarySupportKey = `__support:projectCompany:${projectKey}`
  const legacyPairSupportKey = `${primarySupportKey}:${companyKey}`
  const pairSupportKey = `${primarySupportKey}:${companyId}`
  let supportKey = primarySupportKey
  let registered = await registryRecord(ctx, dataset.organizationId, supportKey)
  if (registered) {
    const registeredId = ctx.db.normalizeId('projectCompanies', registered.recordId)
    const registeredProjectCompany = registeredId ? await ctx.db.get(registeredId) : null
    if (registeredProjectCompany && registeredProjectCompany.companyId !== companyId) {
      const legacyPair = await registryRecord(ctx, dataset.organizationId, legacyPairSupportKey)
      const currentPair = await registryRecord(ctx, dataset.organizationId, pairSupportKey)
      supportKey = legacyPair ? legacyPairSupportKey : pairSupportKey
      registered = legacyPair ?? currentPair
    }
  } else {
    const legacyPair = await registryRecord(ctx, dataset.organizationId, legacyPairSupportKey)
    const currentPair = await registryRecord(ctx, dataset.organizationId, pairSupportKey)
    if (legacyPair || currentPair) {
      supportKey = legacyPair ? legacyPairSupportKey : pairSupportKey
      registered = legacyPair ?? currentPair
    }
  }
  let projectCompany
  if (registered) {
    isShowcaseOwned(registered)
    const id = ctx.db.normalizeId('projectCompanies', registered.recordId)
    if (!id) throw new Error(`invalid project company registry id ${projectKey}`)
    projectCompany = await ctx.db.get(id)
    if (!projectCompany) throw new Error(`registered project company is missing ${projectKey}`)
  } else {
    projectCompany = await ctx.db
      .query('projectCompanies')
      .withIndex('by_project_company_term', (q) =>
        q.eq('projectId', projectId).eq('companyId', companyId).eq('term', 1),
      )
      .unique()
    if (projectCompany) {
      await registerRecord(ctx, {
        dataset,
        recordType: 'projectCompanies',
        externalKey: supportKey,
        recordId: String(projectCompany._id),
        owned: false,
      })
    } else {
      const ownerUser = await ownerUserId(ctx, dataset)
      const now = Date.now()
      const projectCompanyId = await ctx.db.insert('projectCompanies', {
        projectId,
        companyId,
        term: 1,
        status: 'active',
        acceptedBy: ownerUser,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      projectCompany = await ctx.db.get(projectCompanyId)
      await registerRecord(ctx, {
        dataset,
        recordType: 'projectCompanies',
        externalKey: supportKey,
        recordId: String(projectCompanyId),
        owned: true,
      })
    }
  }
  if (!projectCompany) throw new Error(`project company is missing ${projectKey}`)
  if (projectCompany.projectId !== projectId || projectCompany.companyId !== companyId) {
    throw new Error(`project company scope mismatch ${projectKey}`)
  }
  if (projectCompany.status !== 'active') {
    await ctx.db.patch(projectCompany._id, { status: 'active', updatedAt: Date.now() })
    projectCompany = await ctx.db.get(projectCompany._id)
  }
  if (!projectCompany) throw new Error(`project company disappeared ${projectKey}`)
  return projectCompany
}

async function ensureCompanyMember(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  companyId: Id<'companies'>,
  companyDisplayName: string,
  userId: Id<'users'>,
  userRole: string,
) {
  const externalKey = `__support:companyMember:${companyId}:${userId}`
  const existingRegistry = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existingRegistry) {
    if (!existingRegistry.owned) {
      const id = ctx.db.normalizeId('companyMembers', existingRegistry.recordId)
      if (!id) throw new Error('invalid company member registry record')
      if (!(await ctx.db.get(id))) throw new Error('registered company member is missing')
      return id
    }
    const id = ctx.db.normalizeId('companyMembers', existingRegistry.recordId)
    if (!id) throw new Error('invalid company member registry record')
    const user = await ctx.db.get(userId)
    if (!user) throw new Error('company member user is missing')
    const member = await ctx.db.get(id)
    if (!member || member.companyId !== companyId || member.userId !== userId) {
      throw new Error('company member scope mismatch')
    }
    await ctx.db.patch(id, {
      role: companyRole(userRole),
      status: 'active',
      userDisplayNameSnapshot: user.displayName,
      companyDisplayNameSnapshot: companyDisplayName,
      endedAt: undefined,
      updatedAt: Date.now(),
    })
    return id
  }
  const existing = await ctx.db
    .query('companyMembers')
    .withIndex('by_company_user', (q) => q.eq('companyId', companyId).eq('userId', userId))
    .unique()
  if (existing) {
    await registerRecord(ctx, {
      dataset,
      recordType: 'companyMembers',
      externalKey,
      recordId: String(existing._id),
      owned: false,
    })
    return existing._id
  }
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('company member user is missing')
  const now = Date.now()
  const id = await ctx.db.insert('companyMembers', {
    companyId,
    userId,
    role: companyRole(userRole),
    status: 'active',
    userDisplayNameSnapshot: user.displayName,
    companyDisplayNameSnapshot: companyDisplayName,
    createdAt: now,
    updatedAt: now,
  })
  await registerRecord(ctx, {
    dataset,
    recordType: 'companyMembers',
    externalKey,
    recordId: String(id),
    owned: true,
  })
  return id
}

async function ensureTaskBoard(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  creatorProjectMemberId: Id<'projectMembers'>,
  actingCompanyId: Id<'companies'>,
  channelName: string,
) {
  const externalKey = `__support:taskBoard:${groupId}`
  const existingRegistry = await registryRecord(ctx, dataset.organizationId, externalKey)
  let board
  if (existingRegistry) {
    isShowcaseOwned(existingRegistry)
    const boardId = ctx.db.normalizeId('taskBoards', existingRegistry.recordId)
    if (!boardId) throw new Error('invalid task board registry record')
    board = await ctx.db.get(boardId)
    if (!board) throw new Error('registered task board is missing')
  } else {
    board = await ctx.db
      .query('taskBoards')
      .withIndex('by_scope_default', (q) =>
        q.eq('projectId', projectId).eq('groupId', groupId).eq('isDefault', true),
      )
      .unique()
    if (board) {
      await registerRecord(ctx, {
        dataset,
        recordType: 'taskBoards',
        externalKey,
        recordId: String(board._id),
        owned: false,
      })
    } else {
      const now = Date.now()
      const boardId = await ctx.db.insert('taskBoards', {
        projectId,
        groupId,
        name: `${channelName} tasks`,
        description: 'Native Track task board for the showcase channel.',
        rank: '00000001',
        isDefault: true,
        createdByProjectMemberId: creatorProjectMemberId,
        actingCompanyId,
        createdAt: now,
        updatedAt: now,
      })
      board = await ctx.db.get(boardId)
      await registerRecord(ctx, {
        dataset,
        recordType: 'taskBoards',
        externalKey,
        recordId: String(boardId),
        owned: true,
      })
    }
  }
  if (!board || board.projectId !== projectId || board.groupId !== groupId) {
    throw new Error('task board scope mismatch')
  }
  if (!existingRegistry || existingRegistry.owned) {
    await ctx.db.patch(board._id, {
      name: `${channelName} tasks`,
      description: 'Native Track task board for the showcase channel.',
      isDefault: true,
      createdByProjectMemberId: creatorProjectMemberId,
      actingCompanyId,
      updatedAt: Date.now(),
    })
  }
  const states = [
    ['Backlog', 'backlog', 'neutral'],
    ['To do', 'unstarted', 'blue'],
    ['In progress', 'started', 'amber'],
    ['Done', 'completed', 'green'],
    ['Canceled', 'canceled', 'neutral'],
  ] as const
  for (const [index, [name, category, visualToken]] of states.entries()) {
    const stateKey = `${externalKey}:${category}`
    const stateRegistry = await registryRecord(ctx, dataset.organizationId, stateKey)
    let stateId
    if (stateRegistry) {
      isShowcaseOwned(stateRegistry)
      stateId = ctx.db.normalizeId('taskWorkflowStates', stateRegistry.recordId)
      if (!stateId) throw new Error('invalid workflow state registry record')
      const state = await ctx.db.get(stateId)
      if (!state || state.boardId !== board._id) throw new Error('workflow state scope mismatch')
      await ctx.db.patch(stateId, {
        name,
        category,
        visualToken,
        rank: String(index + 1).padStart(4, '0'),
        isDefault: category === 'unstarted',
        archivedAt: undefined,
        updatedAt: Date.now(),
      })
    } else {
      const state = (await ctx.db
        .query('taskWorkflowStates')
        .withIndex('by_board_rank', (q) => q.eq('boardId', board._id))
        .collect())
        .find((candidate) => candidate.category === category)
      if (state) {
        stateId = state._id
        await registerRecord(ctx, {
          dataset,
          recordType: 'taskWorkflowStates',
          externalKey: stateKey,
          recordId: String(state._id),
          owned: false,
        })
      } else {
        const now = Date.now()
        stateId = await ctx.db.insert('taskWorkflowStates', {
          projectId,
          boardId: board._id,
          name,
          category,
          visualToken,
          rank: String(index + 1).padStart(4, '0'),
          isDefault: category === 'unstarted',
          createdAt: now,
          updatedAt: now,
        })
        await registerRecord(ctx, {
          dataset,
          recordType: 'taskWorkflowStates',
          externalKey: stateKey,
          recordId: String(stateId),
          owned: true,
        })
      }
    }
  }
  return board._id
}

async function workflowStateFor(
  ctx: ReadCtx,
  boardId: Id<'taskBoards'>,
  category: string,
) {
  const states = await ctx.db
    .query('taskWorkflowStates')
    .withIndex('by_board_rank', (q) => q.eq('boardId', boardId))
    .collect()
  const state = states.find((candidate) => candidate.category === category)
  if (!state) throw new Error(`missing workflow state ${category}`)
  return state
}

async function applyOrganization(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  record: ShowcaseRecord,
) {
  const externalKey = requiredString(record, 'externalKey')
  if (externalKey !== ORGANIZATION_EXTERNAL_KEY) throw new Error('unexpected Track organization key')
  await registerRecord(ctx, {
    dataset,
    recordType: 'organization',
    externalKey,
    recordId: dataset.organizationId,
    owned: true,
  })
  return dataset.organizationId
}

async function applyCompany(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const ownerUser = await ownerUserId(ctx, dataset)
  const displayName = requiredString(record, 'displayName')
  const normalizedHandle = companyHandle(externalKey)
  const now = Date.now()
  const scene = await ctx.db
    .query('showcaseDatasetAssets')
    .withIndex('by_dataset_organization_asset', (q) =>
      q.eq('datasetId', DATASET_ID)
        .eq('organizationId', dataset.organizationId)
        .eq('assetKey', 'track/catalog/organization-scene'),
    )
    .unique()
  let companyId: Id<'companies'>
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('companies', existing.recordId)
    if (!id) throw new Error(`invalid company registry id ${externalKey}`)
    const company = await ctx.db.get(id)
    if (!company || company.normalizedHandle !== normalizedHandle) throw new Error(`company scope mismatch ${externalKey}`)
    companyId = id
    await ctx.db.patch(id, {
      displayName,
      logoStorageId: externalKey === 'track-company-mosaic-works' ? scene?.storageId : undefined,
      status: 'active',
      updatedAt: now,
    })
  } else {
    const handleCollision = await ctx.db
      .query('companies')
      .withIndex('by_handle', (q) => q.eq('normalizedHandle', normalizedHandle))
      .unique()
    if (handleCollision) throw new Error(`refusing existing customer company handle ${normalizedHandle}`)
    companyId = await ctx.db.insert('companies', {
      displayName,
      normalizedHandle,
      logoStorageId: externalKey === 'track-company-mosaic-works' ? scene?.storageId : undefined,
      status: 'active',
      revision: 1,
      createdBy: ownerUser,
      createdAt: now,
      updatedAt: now,
    })
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'companies',
    externalKey,
    recordId: String(companyId),
    owned: true,
  })
  return String(companyId)
}

async function applyUser(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  record: ShowcaseRecord,
  useOwner: boolean,
) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const now = Date.now()
  let userId: Id<'users'>
  let owned = true
  if (useOwner) {
    userId = await ownerUserId(ctx, dataset)
    owned = false
    if (existing) {
      if (existing.recordId !== String(userId)) throw new Error(`showcase owner binding mismatch ${externalKey}`)
    }
  } else {
    const displayName = requiredString(record, 'displayNameEn')
    const email = `${externalKey}@showcase.track.invalid`
    const googleSubject = `showcase:${DATASET_ID}:${dataset.organizationKey}:${externalKey}`
    if (existing) {
      isShowcaseOwned(existing)
      const id = ctx.db.normalizeId('users', existing.recordId)
      if (!id) throw new Error(`invalid user registry id ${externalKey}`)
      const user = await ctx.db.get(id)
      if (!user || user.googleSubject !== googleSubject) throw new Error(`user scope mismatch ${externalKey}`)
      userId = id
      await ctx.db.patch(id, {
        normalizedEmail: email,
        email,
        displayName,
        profileDesignation: optionalString(record, 'role'),
        updatedAt: now,
      })
    } else {
      const collision = await ctx.db
        .query('users')
        .withIndex('by_google_subject', (q) => q.eq('googleSubject', googleSubject))
        .unique()
      if (collision) throw new Error(`user identity collision ${externalKey}`)
      userId = await ctx.db.insert('users', {
        googleSubject,
        normalizedEmail: email,
        email,
        displayName,
        profileDesignation: optionalString(record, 'role'),
        twoFactorEnabled: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'users',
    externalKey,
    recordId: String(userId),
    owned,
  })
  return String(userId)
}

async function applyProject(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const ownerUser = await ownerUserId(ctx, dataset)
  const companyId = await companyForKey(ctx, dataset, requiredString(record, 'companyKey'))
  const now = Date.now()
  const name = requiredString(record, 'name')
  const domain = requiredString(record, 'domain')
  const description = `Fictional ${domain} project with scoped conversations, evidence, and tasks.`
  let projectId: Id<'projects'>
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('projects', existing.recordId)
    if (!id) throw new Error(`invalid project registry id ${externalKey}`)
    const project = await ctx.db.get(id)
    if (!project) throw new Error(`registered project is missing ${externalKey}`)
    projectId = id
    await ctx.db.patch(id, {
      name,
      clientLabel: domain,
      description,
      accessProfile: 'company',
      proposingCompanyId: companyId,
      status: 'active',
      updatedAt: now,
    })
  } else {
    projectId = await ctx.db.insert('projects', {
      name,
      clientLabel: domain,
      description,
      accessProfile: 'company',
      proposingCompanyId: companyId,
      origin: 'single_company',
      status: 'active',
      participantRevision: 1,
      revision: 1,
      createdBy: ownerUser,
      createdAt: now,
      updatedAt: now,
    })
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'projects',
    externalKey,
    recordId: String(projectId),
    owned: true,
  })
  const general = await generalChannelForProject(ctx, dataset, externalKey, projectId)
  const generalRecord = await registryRecord(ctx, dataset.organizationId, `__support:generalChannel:${externalKey}`)
  if (!generalRecord || generalRecord.owned) {
    await ctx.db.patch(general._id, {
      name: 'General',
      status: 'active',
      updatedAt: now,
    })
  }
  await projectCompanyForProject(ctx, dataset, externalKey, projectId, companyId, requiredString(record, 'companyKey'))
  return String(projectId)
}

async function applyMembership(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const projectKey = requiredString(record, 'projectKey')
  const userKey = requiredString(record, 'userKey')
  const projectId = await projectForKey(ctx, dataset, projectKey)
  const userId = await userForProjectKey(ctx, dataset, userKey, projectKey)
  const companyKey = requiredString(record, 'companyKey')
  const companyId = await companyForKey(ctx, dataset, companyKey)
  const company = await ctx.db.get(companyId)
  const userRecord = await registryRecord(ctx, dataset.organizationId, userKey)
  if (!company || !userRecord) throw new Error('membership parent is missing')
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('membership user is missing')
  await ensureCompanyMember(
    ctx,
    dataset,
    companyId,
    company.displayName,
    userId,
    userId === dataset.ownerUserId ? 'owner' : (user.profileDesignation ?? ''),
  )
  const projectCompany = await projectCompanyForProject(ctx, dataset, projectKey, projectId, companyId, companyKey)
  const project = await ctx.db.get(projectId)
  if (!project) throw new Error('project parent is missing')
  const activeTerms = await ctx.db
    .query('projectCompanies')
    .withIndex('by_project_status', (q) => q.eq('projectId', projectId).eq('status', 'active'))
    .collect()
  if (project.origin !== (activeTerms.length > 1 ? 'shared' : 'single_company')) {
    await ctx.db.patch(projectId, {
      origin: activeTerms.length > 1 ? 'shared' : 'single_company',
      participantRevision: (project.participantRevision ?? 1) + 1,
      revision: (project.revision ?? 1) + 1,
      updatedAt: Date.now(),
    })
  }
  const ownerUser = await ownerUserId(ctx, dataset)
  const now = Date.now()
  const role = projectRole(requiredString(record, 'permission'))
  let projectMemberId: Id<'projectMembers'>
  let membershipOwned = true
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('projectMembers', existing.recordId)
    if (!id) throw new Error(`invalid membership registry id ${externalKey}`)
    const membership = await ctx.db.get(id)
    if (!membership || membership.projectId !== projectId || membership.userId !== userId) {
      throw new Error(`membership scope mismatch ${externalKey}`)
    }
    projectMemberId = id
    await ctx.db.patch(id, {
      role,
      companyId,
      projectCompanyId: projectCompany._id,
      status: 'active',
      term: 1,
      invitedBy: ownerUser,
      userDisplayNameSnapshot: user.displayName,
      companyDisplayNameSnapshot: company.displayName,
      endedAt: undefined,
      updatedAt: now,
    })
  } else {
    const matching = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', (q) => q.eq('projectId', projectId).eq('userId', userId))
      .unique()
    if (matching) {
      projectMemberId = matching._id
      membershipOwned = false
      await registerRecord(ctx, {
        dataset,
        recordType: 'memberships',
        externalKey,
        recordId: String(matching._id),
        owned: false,
      })
    } else {
      projectMemberId = await ctx.db.insert('projectMembers', {
        projectId,
        userId,
        role,
        companyId,
        projectCompanyId: projectCompany._id,
        status: 'active',
        term: 1,
        invitedBy: ownerUser,
        userDisplayNameSnapshot: user.displayName,
        companyDisplayNameSnapshot: company.displayName,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'memberships',
    externalKey,
    recordId: String(projectMemberId),
    owned: membershipOwned,
  })
  const generalChannel = await generalChannelForProject(ctx, dataset, projectKey, projectId)
  await ensureGroupMember(ctx, {
    projectId,
    groupId: generalChannel._id,
    userId,
    projectMemberId,
    isSteward: role === 'manager',
  })
  return String(projectMemberId)
}

async function applyChannel(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const projectId = await projectForKey(ctx, dataset, requiredString(record, 'projectKey'))
  const creatorId = await ownerUserId(ctx, dataset)
  const now = Date.now()
  const name = requiredString(record, 'name')
  let groupId: Id<'groups'>
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('groups', existing.recordId)
    if (!id) throw new Error(`invalid channel registry id ${externalKey}`)
    const channel = await ctx.db.get(id)
    if (!channel || channel.projectId !== projectId || channel.kind !== 'custom') {
      throw new Error(`channel scope mismatch ${externalKey}`)
    }
    groupId = id
    await ctx.db.patch(id, {
      name,
      status: 'active',
      updatedAt: now,
    })
  } else {
    const nameCollision = (await ctx.db
      .query('groups')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect())
      .find((channel) => channel.kind === 'custom' && channel.name === name)
    if (nameCollision) throw new Error(`refusing existing unregistered channel ${externalKey}`)
    groupId = await ctx.db.insert('groups', {
      projectId,
      kind: 'custom',
      name,
      status: 'active',
      revision: 1,
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
    })
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'channels',
    externalKey,
    recordId: String(groupId),
    owned: true,
  })
  const members = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
  for (const member of members) {
    await ensureGroupMember(ctx, {
      projectId,
      groupId,
      userId: member.userId,
      projectMemberId: member._id,
      isSteward: member.role === 'manager',
    })
  }
  return String(groupId)
}

async function applyMessage(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const projectKey = requiredString(record, 'projectKey')
  const projectId = await projectForKey(ctx, dataset, projectKey)
  const groupId = isDefaultScopeMessage(externalKey)
    ? (await generalChannelForProject(ctx, dataset, projectKey, projectId))._id
    : await channelForKey(ctx, dataset, requiredString(record, 'channelKey'))
  const group = await ctx.db.get(groupId)
  const authorKey = requiredString(record, 'authorKey')
  const userId = await userForProjectKey(ctx, dataset, authorKey, projectKey)
  const member = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
    q.eq('projectId', projectId).eq('userId', userId),
  ).unique()
  if (!member) throw new Error(`message author is not a member of ${requiredString(record, 'projectKey')}`)
  if (!group || group.projectId !== projectId) throw new Error('message channel scope mismatch')
  const localIndex = messageLocalIndex(externalKey)
  const mentionCandidates = localIndex % 4 === 0
    ? (await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect())
      .filter((candidate) => candidate.userId !== userId)
    : []
  const mentionedMember = mentionCandidates.length > 0
    ? mentionCandidates[Math.floor(localIndex / 4) % mentionCandidates.length]
    : undefined
  const baseBody = requiredString(record, 'body')
  const mentionedUser = mentionedMember ? await ctx.db.get(mentionedMember.userId) : null
  const body = mentionedMember && mentionedUser
    ? `${baseBody}\n\n${mentionPrompt(optionalString(record, 'locale'), mentionedUser.displayName)}`
    : baseBody
  const mentions = mentionedMember ? [mentionedMember.userId] : []
  const mentionedProjectMemberIds = mentionedMember ? [mentionedMember._id] : []
  const channelSequence = messageSequence(externalKey)
  const now = parseDate(record, 'sentAt') + channelSequence
  let messageId: Id<'messages'>
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('messages', existing.recordId)
    if (!id) throw new Error(`invalid message registry id ${externalKey}`)
    const message = await ctx.db.get(id)
    if (!message || message.projectId !== projectId) throw new Error(`message scope mismatch ${externalKey}`)
    messageId = id
    await ctx.db.patch(id, {
      groupId,
      authorId: userId,
      authorProjectMemberId: member._id,
      actingCompanyId: member.companyId,
      channelSequence,
      idempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      body,
      mentions,
      mentionedProjectMemberIds,
      channelThreadId: undefined,
      replyToMessageId: undefined,
      notificationPreview: body.slice(0, 160),
      createdAt: now,
    })
  } else {
    messageId = await ctx.db.insert('messages', {
      projectId,
      groupId,
      authorId: userId,
      authorProjectMemberId: member._id,
      actingCompanyId: member.companyId,
      channelSequence,
      idempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      body,
      mentions,
      mentionedProjectMemberIds,
      attachmentIds: [],
      notificationPreview: body.slice(0, 160),
      createdAt: now,
    })
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'messages',
    externalKey,
    recordId: String(messageId),
    owned: true,
  })
  return String(messageId)
}

async function ensureThreadReadState(
  ctx: WriteCtx,
  thread: Doc<'channelThreads'>,
  projectMember: Doc<'projectMembers'>,
) {
  const existing = await ctx.db
    .query('channelThreadReadStates')
    .withIndex('by_thread_project_member', (q) =>
      q.eq('channelThreadId', thread._id).eq('projectMemberId', projectMember._id),
    )
    .unique()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, {
      projectId: thread.projectId,
      groupId: thread.groupId,
      userId: projectMember.userId,
      actingCompanyId: projectMember.companyId,
      updatedAt: now,
    })
    return existing._id
  }
  return await ctx.db.insert('channelThreadReadStates', {
    projectId: thread.projectId,
    groupId: thread.groupId,
    channelThreadId: thread._id,
    userId: projectMember.userId,
    projectMemberId: projectMember._id,
    actingCompanyId: projectMember.companyId,
    lastReadChannelSequence: 0,
    createdAt: now,
    updatedAt: now,
  })
}

async function applyThreadRelationships(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>) {
  let createdThreads = 0
  let createdReplies = 0
  for (let projectOffset = 0; projectOffset < expectedCounts.projects; projectOffset += 1) {
    const parentNumber = projectOffset * 40 + THREAD_PARENT_LOCAL_INDEX + 1
    const parentKey = `track-message-${String(parentNumber).padStart(4, '0')}`
    if (threadRole(parentKey) !== 'parent') throw new Error(`invalid deterministic thread parent ${parentKey}`)
    const parentId = await messageForKey(ctx, dataset, parentKey)
    const parent = await ctx.db.get(parentId)
    if (!parent || parent.channelThreadId !== undefined) {
      if (!parent) throw new Error(`thread parent is missing ${parentKey}`)
      await ctx.db.patch(parentId, { channelThreadId: undefined, replyToMessageId: undefined })
    }
    const projectMember = parent?.authorProjectMemberId
      ? await ctx.db.get(parent.authorProjectMemberId)
      : null
    if (!parent || !projectMember) throw new Error(`thread parent author is missing ${parentKey}`)
    const replyKeys = [
      `track-message-${String(parentNumber + 3).padStart(4, '0')}`,
      `track-message-${String(parentNumber + 6).padStart(4, '0')}`,
    ]
    if (replyKeys.some((key) => threadRole(key) !== 'reply')) throw new Error(`invalid deterministic thread replies ${parentKey}`)
    const replyIds = await Promise.all(replyKeys.map((key) => messageForKey(ctx, dataset, key)))
    const replies = await Promise.all(replyIds.map((id) => ctx.db.get(id)))
    if (replies.some((reply) => !reply)) throw new Error(`thread replies are incomplete ${parentKey}`)
    const validReplies = replies.filter((reply): reply is Doc<'messages'> => reply !== null)
    if (validReplies.some((reply) => reply.projectId !== parent.projectId || reply.groupId !== parent.groupId)) {
      throw new Error(`thread reply scope mismatch ${parentKey}`)
    }
    const threadExternalKey = threadKey(parentKey)
    const idempotencyKey = `${DATASET_ID}:${dataset.organizationKey}:${threadExternalKey}`
    const existingRegistry = await registryRecord(ctx, dataset.organizationId, threadExternalKey)
    let threadId: Id<'channelThreads'>
    let thread: Doc<'channelThreads'> | null
    if (existingRegistry) {
      isShowcaseOwned(existingRegistry)
      const id = ctx.db.normalizeId('channelThreads', existingRegistry.recordId)
      if (!id) throw new Error(`invalid thread registry id ${threadExternalKey}`)
      threadId = id
      thread = await ctx.db.get(id)
      if (!thread) throw new Error(`registered thread is missing ${threadExternalKey}`)
    } else {
      const existingThread = await ctx.db
        .query('channelThreads')
        .withIndex('by_group_idempotency', (q) =>
          q.eq('groupId', parent.groupId).eq('idempotencyKey', idempotencyKey),
        )
        .unique()
      if (existingThread) {
        threadId = existingThread._id
        thread = existingThread
        await registerRecord(ctx, {
          dataset,
          recordType: 'channelThreads',
          externalKey: threadExternalKey,
          recordId: String(existingThread._id),
          owned: false,
        })
      } else {
        const createdAt = parent.createdAt + 1
        threadId = await ctx.db.insert('channelThreads', {
          projectId: parent.projectId,
          groupId: parent.groupId,
          name: `Decision follow-up ${String(projectOffset + 1).padStart(2, '0')}`,
          sourceMessageId: parent._id,
          creatorUserId: parent.authorId,
          creatorProjectMemberId: projectMember._id,
          actingCompanyId: parent.actingCompanyId,
          status: 'active',
          revision: 1,
          replyCount: validReplies.length,
          latestReplyAt: Math.max(...validReplies.map((reply) => reply.createdAt)),
          latestChannelSequence: Math.max(...validReplies.map((reply) => reply.channelSequence ?? 0)),
          idempotencyKey,
          createdAt,
          updatedAt: createdAt,
        })
        thread = await ctx.db.get(threadId)
        if (!thread) throw new Error(`thread creation failed ${threadExternalKey}`)
        createdThreads += 1
        await registerRecord(ctx, {
          dataset,
          recordType: 'channelThreads',
          externalKey: threadExternalKey,
          recordId: String(threadId),
          owned: true,
        })
      }
    }
    if (!thread || thread.projectId !== parent.projectId || thread.groupId !== parent.groupId) {
      throw new Error(`thread scope mismatch ${threadExternalKey}`)
    }
    await ctx.db.patch(threadId, {
      sourceMessageId: parent._id,
      creatorUserId: parent.authorId,
      creatorProjectMemberId: projectMember._id,
      actingCompanyId: parent.actingCompanyId,
      status: 'active',
      replyCount: validReplies.length,
      latestReplyAt: Math.max(...validReplies.map((reply) => reply.createdAt)),
      latestChannelSequence: Math.max(...validReplies.map((reply) => reply.channelSequence ?? 0)),
      createdAt: parent.createdAt + 1,
      archivedAt: undefined,
      updatedAt: Date.now(),
    })
    const refreshedThread = await ctx.db.get(threadId)
    if (!refreshedThread) throw new Error(`thread disappeared ${threadExternalKey}`)
    await ctx.db.patch(parent._id, {
      channelThreadId: undefined,
      replyToMessageId: undefined,
    })
    await upsertThreadFollower(ctx, {
      thread: refreshedThread,
      userId: projectMember.userId,
      projectMember,
      actingCompanyId: projectMember.companyId,
      reason: 'created',
    })
    await ensureThreadReadState(ctx, refreshedThread, projectMember)
    for (const [replyIndex, reply] of validReplies.entries()) {
      const replyMember = reply.authorProjectMemberId
        ? await ctx.db.get(reply.authorProjectMemberId)
        : null
      if (!replyMember) throw new Error(`thread reply author is missing ${replyKeys[replyIndex]}`)
      const body = threadReplyBody(parent.body, projectOffset, replyIndex)
      await ctx.db.patch(reply._id, {
        channelThreadId: threadId,
        replyToMessageId: parent._id,
        body,
        notificationPreview: body.slice(0, 160),
      })
      await upsertThreadFollower(ctx, {
        thread: refreshedThread,
        userId: replyMember.userId,
        projectMember: replyMember,
        actingCompanyId: replyMember.companyId,
        reason: 'replied',
      })
      if (reply.channelThreadId !== threadId) createdReplies += 1
    }
  }
  return {
    createdThreads,
    createdReplies,
    channelThreads: relationshipCounts.channelThreads,
    threadReplies: relationshipCounts.threadReplies,
  }
}

async function applyTask(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const projectKey = requiredString(record, 'projectKey')
  const projectId = await projectForKey(ctx, dataset, projectKey)
  const sourceMessageId = await messageForKey(ctx, dataset, requiredString(record, 'sourceMessageKey'))
  const sourceMessage = await ctx.db.get(sourceMessageId)
  if (!sourceMessage || sourceMessage.projectId !== projectId) throw new Error('task source message scope mismatch')
  const creator = sourceMessage.authorProjectMemberId
  if (!creator) throw new Error('task source message has no project membership')
  const creatorMember = await ctx.db.get(creator)
  if (!creatorMember || !creatorMember.companyId) throw new Error('task creator membership is missing')
  const assigneeId = await userForProjectKey(ctx, dataset, requiredString(record, 'assigneeKey'), projectKey)
  const assignee = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
    q.eq('projectId', projectId).eq('userId', assigneeId),
  ).unique()
  if (!assignee) throw new Error('task assignee is not a project member')
  const group = await ctx.db.get(sourceMessage.groupId)
  if (!group) throw new Error('task channel is missing')
  const boardId = await ensureTaskBoard(
    ctx,
    dataset,
    projectId,
    sourceMessage.groupId,
    creator,
    creatorMember.companyId,
    group.name,
  )
  const state = await workflowStateFor(ctx, boardId, taskStateCategory(requiredString(record, 'state')))
  const now = parseDate(record, 'dueAt')
  const taskNumber = Number(externalKey.replace('track-task-', ''))
  if (!Number.isInteger(taskNumber) || taskNumber < 1 || taskNumber > expectedCounts.tasks) {
    throw new Error(`invalid Track task key ${externalKey}`)
  }
  const publicKey = externalKey.replace('track-task-', 'TRK-').toUpperCase()
  const title = requiredString(record, 'title')
  const taskFields = {
    projectId,
    publicKey,
    boardId,
    groupId: sourceMessage.groupId,
    workflowStateId: state._id,
    rank: rankForIndex(taskNumber - 1),
    title,
    description: `Action captured from the project discussion: ${sourceNarrative(sourceMessage.body)}.`,
    searchText: `${title} ${requiredString(record, 'state')}`,
    assigneeProjectMemberId: assignee._id,
    priority: taskPriority(taskNumber),
    dueDate: new Date(now).toISOString().slice(0, 10),
    createdByProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
    revision: 1,
    terminalAt: state.category === 'completed' ? sourceMessage.createdAt + 1000 + taskNumber : undefined,
    createIdempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
  }
  let taskId: Id<'tasks'>
  let taskOwned = true
  let task
  if (existing) {
    isShowcaseOwned(existing)
    const id = ctx.db.normalizeId('tasks', existing.recordId)
    if (!id) throw new Error(`invalid task registry id ${externalKey}`)
    task = await ctx.db.get(id)
    if (!task || task.projectId !== projectId) throw new Error(`task scope mismatch ${externalKey}`)
    taskId = id
    await ctx.db.patch(id, { ...taskFields, updatedAt: Date.now() })
  } else {
    const matching = await ctx.db.query('tasks').withIndex('by_project_key', (q) =>
      q.eq('projectId', projectId).eq('publicKey', publicKey),
    ).unique()
    if (matching) {
      taskId = matching._id
      task = matching
      taskOwned = false
      await registerRecord(ctx, {
        dataset,
        recordType: 'tasks',
        externalKey,
        recordId: String(taskId),
        owned: false,
      })
    } else {
      const createdAt = sourceMessage.createdAt + 1000 + taskNumber
      taskId = await ctx.db.insert('tasks', {
        ...taskFields,
        createdAt,
        updatedAt: createdAt,
      })
      task = await ctx.db.get(taskId)
    }
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'tasks',
    externalKey,
    recordId: String(taskId),
    owned: taskOwned,
  })
  if (!task) throw new Error('task creation failed')
  if (!taskOwned) return String(taskId)
  const createdAt = task.createdAt
  const references = await ctx.db.query('taskReferences').withIndex('by_task_rank', (q) =>
    q.eq('taskId', taskId).eq('rank', rankForIndex(0)),
  ).collect()
  const reference = references[0]
  const referenceFields = {
    projectId,
    taskId,
    type: 'message' as const,
    groupId: sourceMessage.groupId,
    channelThreadId: sourceMessage.channelThreadId,
    messageId: sourceMessageId,
    quote: sourceMessage.body.slice(0, 280),
    availability: 'available' as const,
    isPrimary: true,
    actorProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
    rank: rankForIndex(0),
    updatedAt: Date.now(),
  }
  if (reference) await ctx.db.patch(reference._id, referenceFields)
  else await ctx.db.insert('taskReferences', { ...referenceFields, createdAt })
  const followerMembers = [
    { member: creator, userId: creatorMember.userId, reason: 'creator' as const },
    ...(assignee._id !== creator ? [{ member: assignee._id, userId: assignee.userId, reason: 'assignee' as const }] : []),
  ]
  for (const followerInput of followerMembers) {
    const followers = await ctx.db.query('taskFollowers').withIndex('by_task_member', (q) =>
      q.eq('taskId', taskId).eq('projectMemberId', followerInput.member),
    ).collect()
    const follower = followers[0]
    const followerFields = {
      projectId,
      taskId,
      userId: followerInput.userId,
      projectMemberId: followerInput.member,
      reason: followerInput.reason,
      enabled: true,
      updatedAt: Date.now(),
    }
    if (follower) await ctx.db.patch(follower._id, followerFields)
    else await ctx.db.insert('taskFollowers', { ...followerFields, createdAt })
  }
  const activities = await ctx.db.query('taskActivities').withIndex('by_task_created_at', (q) =>
    q.eq('taskId', taskId),
  ).collect()
  const activity = activities.find((candidate) => candidate.action === 'created')
  const correlationId = `${DATASET_ID}:${dataset.organizationKey}:${externalKey}:created`
  if (activity) await ctx.db.patch(activity._id, { correlationId })
  else await appendTaskActivity(ctx, {
    task,
    action: 'created',
    actorProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
    correlationId,
  })
  return String(taskId)
}

async function ensureSuggestionReference(
  ctx: WriteCtx,
  source: Doc<'messages'>,
  suggestionId: Id<'taskSuggestions'>,
  rank: string,
  isPrimary: boolean,
  createdAt: number,
) {
  const references = await ctx.db.query('taskSuggestionReferences').withIndex('by_suggestion_rank', (q) =>
    q.eq('suggestionId', suggestionId).eq('rank', rank),
  ).collect()
  const fields = {
    projectId: source.projectId,
    suggestionId,
    type: 'message' as const,
    groupId: source.groupId,
    channelThreadId: source.channelThreadId,
    messageId: source._id,
    quote: source.body.slice(0, 280),
    availability: 'available' as const,
    isPrimary,
    rank,
    updatedAt: Date.now(),
  }
  if (references[0]) await ctx.db.patch(references[0]._id, fields)
  else await ctx.db.insert('taskSuggestionReferences', { ...fields, createdAt })
}

async function applySuggestion(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) isShowcaseOwned(existing)
  const sourceKeys = arrayField(record, 'sourceMessageKeys').map((value) => {
    if (typeof value !== 'string') throw new Error('source message key must be a string')
    return value
  })
  if (sourceKeys.length !== 2) throw new Error('Track suggestions must cite two messages')
  const sourceIds = await Promise.all(sourceKeys.map((key) => messageForKey(ctx, dataset, key)))
  const source = await ctx.db.get(sourceIds[0])
  const secondSource = await ctx.db.get(sourceIds[1])
  if (!source || !secondSource || source.projectId !== secondSource.projectId) {
    throw new Error('suggestion source messages must share a project')
  }
  const taskId = await taskForKey(ctx, dataset, requiredString(record, 'suggestedTaskKey'))
  const task = await ctx.db.get(taskId)
  if (!task || task.projectId !== source.projectId) throw new Error('suggestion task scope mismatch')
  const creator = source.authorProjectMemberId
  if (!creator) throw new Error('suggestion author membership is missing')
  const creatorMember = await ctx.db.get(creator)
  if (!creatorMember) throw new Error('suggestion creator is missing')
  const disposition = requiredString(record, 'disposition')
  const accepted = disposition === 'accepted' || disposition === 'corrected'
  const pending = disposition === 'pending'
  if (!pending && !accepted && disposition !== 'rejected') throw new Error(`unsupported suggestion disposition ${disposition}`)
  const now = Date.now()
  const status = pending ? 'pending' as const : accepted ? 'accepted' as const : 'dismissed' as const
  const explanation = requiredString(record, 'explanation')
  let suggestionId: Id<'taskSuggestions'>
  let createdAt = now
  if (existing) {
    const id = ctx.db.normalizeId('taskSuggestions', existing.recordId)
    if (!id) throw new Error(`invalid suggestion registry id ${externalKey}`)
    const suggestion = await ctx.db.get(id)
    if (!suggestion || suggestion.projectId !== source.projectId) {
      throw new Error(`registered suggestion scope mismatch ${externalKey}`)
    }
    suggestionId = id
    createdAt = suggestion.createdAt
    await ctx.db.patch(id, {
      groupId: source.groupId,
      proposedTitle: task.title,
      proposedDescription: explanation,
      proposedAssigneeProjectMemberId: task.assigneeProjectMemberId,
      proposedPriority: task.priority,
      proposedDueDate: task.dueDate,
      status,
      confidence: disposition === 'corrected' ? 0.86 : 0.92,
      groundingReason: explanation,
      decidedByProjectMemberId: pending ? undefined : creator,
      decisionActingCompanyId: pending ? undefined : creatorMember.companyId,
      dismissalReason: pending || accepted ? undefined : 'not_actionable',
      decidedTaskId: accepted ? taskId : undefined,
      duplicateOverride: pending ? undefined : disposition === 'corrected',
      decisionIdempotencyKey: pending ? undefined : `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      updatedAt: now,
      decidedAt: pending ? undefined : suggestion.decidedAt ?? now,
    })
  } else {
    suggestionId = await ctx.db.insert('taskSuggestions', {
      projectId: source.projectId,
      groupId: source.groupId,
      proposedTitle: task.title,
      proposedDescription: explanation,
      proposedAssigneeProjectMemberId: task.assigneeProjectMemberId,
      proposedPriority: task.priority,
      proposedDueDate: task.dueDate,
      status,
      confidence: disposition === 'corrected' ? 0.86 : 0.92,
      groundingReason: explanation,
      fingerprint: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      decidedByProjectMemberId: pending ? undefined : creator,
      decisionActingCompanyId: pending ? undefined : creatorMember.companyId,
      dismissalReason: pending || accepted ? undefined : 'not_actionable',
      decidedTaskId: accepted ? taskId : undefined,
      duplicateOverride: pending ? undefined : disposition === 'corrected',
      decisionIdempotencyKey: pending ? undefined : `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      modelVersion: 'showcase-precomputed-v1',
      promptVersion: 'showcase-precomputed-v1',
      createdAt,
      updatedAt: now,
      decidedAt: pending ? undefined : now,
    })
  }
  await registerRecord(ctx, {
    dataset,
    recordType: 'suggestions',
    externalKey,
    recordId: String(suggestionId),
    owned: true,
  })
  for (const [index, messageId] of sourceIds.entries()) {
    const message = await ctx.db.get(messageId)
    if (!message) throw new Error('suggestion message disappeared')
    await ensureSuggestionReference(ctx, message, suggestionId, rankForIndex(index), index === 0, createdAt)
  }
  if (accepted) {
    if (task.sourceSuggestionId && task.sourceSuggestionId !== suggestionId) {
      throw new Error(`suggestion task is already linked to another suggestion ${externalKey}`)
    }
    if (task.sourceSuggestionId !== suggestionId) await ctx.db.patch(taskId, { sourceSuggestionId: suggestionId, updatedAt: now })
  } else if (task.sourceSuggestionId === suggestionId) {
    await ctx.db.patch(taskId, { sourceSuggestionId: undefined, updatedAt: now })
  }
  return String(suggestionId)
}

async function applyAttachment(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const projectId = await projectForKey(ctx, dataset, requiredString(record, 'projectKey'))
  const messageId = await messageForKey(ctx, dataset, requiredString(record, 'messageKey'))
  const message = await ctx.db.get(messageId)
  if (!message || message.projectId !== projectId) throw new Error('attachment message scope mismatch')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  const asset = await assetForKey(ctx, dataset, requiredString(record, 'assetKey'))
  const metadata = asset.metadata
  const duration = metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata.duration === 'number'
    ? metadata.duration * 1000
    : undefined
  const kind = requiredString(record, 'kind') === 'voice-note' ? 'voice_note' as const : 'file' as const
  const filename = asset.storageKey.split('/').at(-1) ?? externalKey
  if (existing) {
    isShowcaseOwned(existing)
    const existingId = ctx.db.normalizeId('attachments', existing.recordId)
    if (!existingId) throw new Error(`invalid attachment registry id ${externalKey}`)
    const attachment = await ctx.db.get(existingId)
    if (!attachment || attachment.projectId !== projectId) throw new Error(`registered attachment scope mismatch ${externalKey}`)
    await ctx.db.patch(existingId, {
      groupId: message.groupId,
      messageId,
      channelThreadId: message.channelThreadId,
      storageId: asset.storageId,
      filename,
      contentType: asset.mimeType,
      size: asset.fileSize,
      kind,
      durationMs: duration,
      uploadedBy: message.authorId,
      uploadedByProjectMemberId: message.authorProjectMemberId,
      actingCompanyId: message.actingCompanyId,
      extractionStatus: 'preserved',
    })
    if (!message.attachmentIds.includes(existingId)) {
      await ctx.db.patch(messageId, { attachmentIds: [...message.attachmentIds, existingId] })
    }
    return existing.recordId
  }
  const attachmentId = await ctx.db.insert('attachments', {
    projectId,
    groupId: message.groupId,
    messageId,
    channelThreadId: message.channelThreadId,
    storageId: asset.storageId,
    filename,
    contentType: asset.mimeType,
    size: asset.fileSize,
    kind,
    durationMs: duration,
    uploadedBy: message.authorId,
    uploadedByProjectMemberId: message.authorProjectMemberId,
    actingCompanyId: message.actingCompanyId,
    extractionStatus: 'preserved',
    createdAt: Date.now(),
  })
  await ctx.db.patch(messageId, { attachmentIds: [...message.attachmentIds, attachmentId] })
  await registerRecord(ctx, {
    dataset,
    recordType: 'attachments',
    externalKey,
    recordId: String(attachmentId),
    owned: true,
  })
  return String(attachmentId)
}

async function applyRecords(
  ctx: WriteCtx,
  dataset: Doc<'showcaseDatasets'>,
  recordType: string,
  records: unknown[],
) {
  const recordIds: Array<{ externalKey: string; recordId: string }> = []
  let inserted = 0
  let updated = 0
  for (const [index, value] of records.entries()) {
    const record = recordObject(value, `${recordType}[${index}]`)
    const externalKey = requiredString(record, 'externalKey')
    const prior = await registryRecord(ctx, dataset.organizationId, externalKey)
    let recordId: string
    if (recordType === 'organizations') recordId = await applyOrganization(ctx, dataset, record)
    else if (recordType === 'companies') recordId = await applyCompany(ctx, dataset, record)
    else if (recordType === 'users') recordId = await applyUser(ctx, dataset, record, externalKey === OWNER_USER_EXTERNAL_KEY)
    else if (recordType === 'projects') recordId = await applyProject(ctx, dataset, record)
    else if (recordType === 'memberships') recordId = await applyMembership(ctx, dataset, record)
    else if (recordType === 'channels') recordId = await applyChannel(ctx, dataset, record)
    else if (recordType === 'messages') recordId = await applyMessage(ctx, dataset, record)
    else if (recordType === 'tasks') recordId = await applyTask(ctx, dataset, record)
    else if (recordType === 'suggestions') recordId = await applySuggestion(ctx, dataset, record)
    else if (recordType === 'attachments') recordId = await applyAttachment(ctx, dataset, record)
    else throw new Error(`unsupported Track record type ${recordType}`)
    if (prior) updated += 1
    else inserted += 1
    recordIds.push({ externalKey, recordId })
  }
  return { inserted, updated, recordIds }
}

const commonArgs = {
  datasetId: v.literal(DATASET_ID),
  organizationKey: v.string(),
  organizationId: v.string(),
}

export const resolveOrganization = internalQuery({
  args: {
    datasetId: v.literal(DATASET_ID),
    product: v.literal(PRODUCT),
    organizationKey: v.string(),
    companyHandles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const owned = await datasetByKey(ctx, args.organizationKey)
    if (owned) return {
      status: 'owned' as const,
      organizationId: owned.organizationId,
      ownerUserId: owned.ownerUserId ? String(owned.ownerUserId) : null,
    }
    const handles = [args.organizationKey, ...(args.companyHandles ?? [])]
    for (const handle of handles) {
      const existing = await ctx.db
        .query('companies')
        .withIndex('by_handle', (q) => q.eq('normalizedHandle', handle))
        .unique()
      if (existing) return { status: 'existing-customer' as const, organizationId: String(existing._id) }
    }
    return { status: 'missing' as const }
  },
})

export const createOrganization = internalMutation({
  args: {
    datasetId: v.literal(DATASET_ID),
    datasetVersion: v.literal(DATASET_VERSION),
    product: v.literal(PRODUCT),
    organizationKey: v.string(),
    displayName: v.string(),
    ownerUserId: v.id('users'),
    companyHandles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await datasetByKey(ctx, args.organizationKey)
    if (existing) return { organizationId: existing.organizationId }
    const owner = await ctx.db.get(args.ownerUserId)
    if (!owner) throw new Error('showcase owner user does not exist')
    for (const handle of [args.organizationKey, ...args.companyHandles]) {
      const collision = await ctx.db
        .query('companies')
        .withIndex('by_handle', (q) => q.eq('normalizedHandle', handle))
        .unique()
      if (collision) throw new Error(`refusing existing customer company handle ${handle}`)
    }
    const now = Date.now()
    const datasetId = await ctx.db.insert('showcaseDatasets', {
      datasetId: DATASET_ID,
      datasetVersion: DATASET_VERSION,
      product: PRODUCT,
      organizationKey: args.organizationKey,
      organizationId: args.organizationKey,
      status: 'planned',
      counts: expectedCounts,
      assetCount: 0,
      manifestHash: '',
      assetManifestHash: '',
      ownerUserId: owner._id,
      createdAt: now,
      updatedAt: now,
    })
    const organizationId = String(datasetId)
    await ctx.db.patch(datasetId, { organizationId, updatedAt: now })
    return { organizationId }
  },
})

export const begin = internalMutation({
  args: {
    ...commonArgs,
    datasetVersion: v.literal(DATASET_VERSION),
    product: v.literal(PRODUCT),
    manifestHash: v.string(),
    assetManifestHash: v.string(),
    counts: v.any(),
    assetCount: v.number(),
    ownerUserId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey)
    if (dataset.status === 'removing' || dataset.status === 'removed') {
      throw new Error('removed showcase datasets cannot be reapplied')
    }
    if (args.manifestHash !== MANIFEST_HASH || args.assetManifestHash !== ASSET_MANIFEST_HASH) throw new Error('showcase checksum mismatch')
    if (args.assetCount !== 61 || !hasExpectedCounts(args.counts)) throw new Error('showcase count contract mismatch')
    if (dataset.ownerUserId && args.ownerUserId && dataset.ownerUserId !== args.ownerUserId) throw new Error('showcase owner user mismatch')
    const owner = args.ownerUserId ?? dataset.ownerUserId
    if (!owner || !(await ctx.db.get(owner))) throw new Error('showcase owner user is required')
    await ctx.db.patch(dataset._id, {
      datasetVersion: args.datasetVersion,
      product: args.product,
      status: 'applying',
      counts: args.counts,
      assetCount: args.assetCount,
      manifestHash: args.manifestHash,
      assetManifestHash: args.assetManifestHash,
      ownerUserId: owner,
      updatedAt: Date.now(),
    })
    const updated = await ctx.db.get(dataset._id)
    if (!updated) throw new Error('showcase dataset disappeared')
    await registerRecord(ctx, {
      dataset: updated,
      recordType: 'organization',
      externalKey: ORGANIZATION_EXTERNAL_KEY,
      recordId: updated.organizationId,
      owned: true,
    })
    return { organizationId: updated.organizationId, status: 'applying' as const }
  },
})

export const generateAssetUploadUrl = internalMutation({
  args: {
    ...commonArgs,
    assetKey: v.string(),
  },
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'applying')
    if (!args.assetKey.startsWith(`${PRODUCT}/`)) throw new Error('asset key is outside Track showcase scope')
    const existing = await ctx.db
      .query('showcaseDatasetAssets')
      .withIndex('by_dataset_organization_asset', (q) =>
        q.eq('datasetId', DATASET_ID)
          .eq('organizationId', dataset.organizationId)
          .eq('assetKey', args.assetKey),
      )
      .unique()
    if (existing) return { uploadUrl: null, storageId: existing.storageId, reused: true }
    return { uploadUrl: await ctx.storage.generateUploadUrl(), storageId: null, reused: false }
  },
})

export const applyAssets = internalMutation({
  args: {
    ...commonArgs,
    datasetVersion: v.literal(DATASET_VERSION),
    assets: v.array(v.any()),
    storageIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'applying')
    let inserted = 0
    let skipped = 0
    for (const [index, value] of args.assets.entries()) {
      const asset = recordObject(value, `assets[${index}]`)
      const assetKey = requiredString(asset, 'assetKey')
      const contentHash = requiredString(asset, 'contentHash')
      const storageId = args.storageIds[index]
      if (!storageId) throw new Error(`invalid storage id for ${assetKey}`)
      const existing = await ctx.db
        .query('showcaseDatasetAssets')
        .withIndex('by_dataset_organization_asset', (q) =>
          q.eq('datasetId', DATASET_ID)
            .eq('organizationId', dataset.organizationId)
            .eq('assetKey', assetKey),
        )
        .unique()
      if (existing) {
        if (existing.contentHash !== contentHash || existing.storageId !== storageId) throw new Error(`asset ${assetKey} is already bound to another binary`)
        await ctx.db.patch(existing._id, {
          datasetVersion: args.datasetVersion,
          product: PRODUCT,
          organizationKey: dataset.organizationKey,
          organizationId: dataset.organizationId,
          storageKey: requiredString(asset, 'storageKey'),
          mimeType: requiredString(asset, 'mimeType'),
          fileSize: requiredNumber(asset, 'fileSize'),
          metadata: asset,
        })
        await registerRecord(ctx, {
          dataset,
          recordType: 'showcaseDatasetAssets',
          externalKey: assetKey,
          recordId: String(existing._id),
          owned: true,
        })
        skipped += 1
        continue
      }
      const assetId = await ctx.db.insert('showcaseDatasetAssets', {
        datasetId: DATASET_ID,
        datasetVersion: args.datasetVersion,
        product: PRODUCT,
        organizationKey: dataset.organizationKey,
        organizationId: dataset.organizationId,
        assetKey,
        contentHash,
        storageKey: requiredString(asset, 'storageKey'),
        storageId,
        mimeType: requiredString(asset, 'mimeType'),
        fileSize: requiredNumber(asset, 'fileSize'),
        metadata: asset,
        createdAt: Date.now(),
      })
      await registerRecord(ctx, {
        dataset,
        recordType: 'showcaseDatasetAssets',
        externalKey: assetKey,
        recordId: String(assetId),
        owned: true,
      })
      inserted += 1
    }
    return { inserted, skipped }
  },
})

export const applyBatch = internalMutation({
  args: {
    ...commonArgs,
    datasetVersion: v.literal(DATASET_VERSION),
    recordType: recordTypeValidator,
    records: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'applying')
    if (dataset.datasetVersion !== args.datasetVersion) throw new Error('showcase dataset version mismatch')
    return await applyRecords(ctx, dataset, args.recordType, args.records)
  },
})

export const applyRelationships = internalMutation({
  args: commonArgs,
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'applying')
    if (await registryCount(ctx, dataset, 'messages') !== expectedCounts.messages) {
      throw new Error('messages must be fully applied before relationships')
    }
    return await applyThreadRelationships(ctx, dataset)
  },
})

async function registryCount(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>, recordType: string) {
  return (await ctx.db
    .query('showcaseDatasetRecords')
    .withIndex('by_dataset_organization_type', (q) =>
      q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId).eq('recordType', recordType),
    )
    .collect()).length
}

export const finalize = internalMutation({
  args: commonArgs,
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'applying')
    const expected = {
      organization: expectedCounts.organizations,
      companies: expectedCounts.companies,
      users: expectedCounts.users,
      projects: expectedCounts.projects,
      memberships: expectedCounts.memberships,
      channels: expectedCounts.channels,
      messages: expectedCounts.messages,
      tasks: expectedCounts.tasks,
      suggestions: expectedCounts.suggestions,
      attachments: expectedCounts.attachments,
    } satisfies Record<ManifestRecordType, number>
    for (const [recordType, count] of Object.entries(expected)) {
      if (await registryCount(ctx, dataset, recordType) !== count) throw new Error(`${recordType} registry count is incomplete`)
    }
    if ((await ctx.db.query('showcaseDatasetAssets').withIndex('by_organization', (q) => q.eq('organizationId', dataset.organizationId)).collect()).length !== dataset.assetCount) {
      throw new Error('asset registry count is incomplete')
    }
    if (await registryCount(ctx, dataset, 'channelThreads') !== relationshipCounts.channelThreads) {
      throw new Error('channel thread registry count is incomplete')
    }
    await ctx.db.patch(dataset._id, { status: 'applied', updatedAt: Date.now() })
    return { organizationId: dataset.organizationId, status: 'applied' as const }
  },
})

async function relationshipErrors(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>) {
  const errors: string[] = []
  const records = await ctx.db
    .query('showcaseDatasetRecords')
    .withIndex('by_dataset_organization', (q) => q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId))
    .collect()
  const byKey = new Map(records.map((record) => [record.externalKey, record]))
  const requireDocument = async <T extends NativeTable>(key: string, table: T): Promise<Doc<T> | null> => {
    const record = byKey.get(key)
    if (!record) {
      errors.push(`missing registry record ${key}`)
      return null
    }
    const id = ctx.db.normalizeId(table, record.recordId)
    if (!id) {
      errors.push(`invalid ${table} id for ${key}`)
      return null
    }
    const document = await ctx.db.get(id)
    if (!document) errors.push(`missing ${table} document for ${key}`)
    return document
  }
  const projectRecords = records.filter((record) => record.recordType === 'projects')
  for (const projectRecord of projectRecords) {
    const project = await requireDocument(projectRecord.externalKey, 'projects')
    if (!project) continue
    if (project.status !== 'active' || project.accessProfile !== 'company') errors.push(`${projectRecord.externalKey} is not an active company project`)
    const company = records.find((record) => record.recordType === 'companies' && String(project.proposingCompanyId) === record.recordId)
    if (!company) errors.push(`${projectRecord.externalKey} has no owned proposing company`)
    const terms = await ctx.db.query('projectCompanies').withIndex('by_project_status', (q) => q.eq('projectId', project._id).eq('status', 'active')).collect()
    if (terms.length === 0) errors.push(`${projectRecord.externalKey} has no active project company`)
    if (terms.length > 1 && project.origin !== 'shared') errors.push(`${projectRecord.externalKey} is not classified as shared`)
    const generalChannels = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect())
      .filter((group) => group.kind === 'general')
    if (generalChannels.length !== 1) errors.push(`${projectRecord.externalKey} must have one General channel`)
    const projectMembers = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect()
    const activeGroups = await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect()
    for (const member of projectMembers.filter((candidate) => candidate.status === 'active')) {
      for (const group of activeGroups.filter((candidate) => candidate.status === 'active')) {
        const groupMember = await ctx.db.query('groupMembers').withIndex('by_group_project_member', (q) =>
          q.eq('groupId', group._id).eq('projectMemberId', member._id),
        ).unique()
        if (!groupMember || groupMember.status !== 'active') errors.push(`${projectRecord.externalKey} has incomplete channel membership for ${member._id}:${group._id}`)
      }
    }
    for (const term of terms) {
      if (!records.some((record) => record.recordType === 'projectCompanies' && record.recordId === String(term._id))) {
        errors.push(`${projectRecord.externalKey} has an unowned project company`)
      }
    }
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'memberships')) {
    const membership = await requireDocument(record.externalKey, 'projectMembers')
    if (!membership) continue
    const project = await ctx.db.get(membership.projectId)
    const user = await ctx.db.get(membership.userId)
    if (!project || !user || membership.status !== 'active' || !membership.projectCompanyId) errors.push(`${record.externalKey} has incomplete project membership`)
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'channels')) {
    const channel = await requireDocument(record.externalKey, 'groups')
    if (!channel || channel.status !== 'active') errors.push(`${record.externalKey} is not an active channel`)
    else if ((await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', channel._id)).collect()).length === 0) errors.push(`${record.externalKey} has no members`)
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'messages')) {
    const message = await requireDocument(record.externalKey, 'messages')
    if (!message) continue
    if (!byKey.get(record.externalKey)) errors.push(`${record.externalKey} is not registered`)
    const channel = await ctx.db.get(message.groupId)
    const author = await ctx.db.get(message.authorId)
    if (!channel || !author || channel.projectId !== message.projectId) errors.push(`${record.externalKey} has incomplete message scope`)
    if (message.mentions.some((userId) => !records.some((candidate) => candidate.recordType === 'users' && candidate.recordId === String(userId)))) {
      errors.push(`${record.externalKey} mentions an unowned user`)
    }
    if ((message.mentionedProjectMemberIds ?? []).some((memberId) => !records.some((candidate) => candidate.recordType === 'memberships' && candidate.recordId === String(memberId)))) {
      errors.push(`${record.externalKey} mentions an unowned project member`)
    }
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'tasks')) {
    const task = await requireDocument(record.externalKey, 'tasks')
    if (!task) continue
    const source = await ctx.db.query('taskReferences').withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect()
    if (!source.some((reference) => reference.type === 'message' && reference.messageId)) errors.push(`${record.externalKey} has no message evidence`)
    for (const reference of source.filter((candidate) => candidate.type === 'message')) {
      const message = reference.messageId ? await ctx.db.get(reference.messageId) : null
      if (!message || message.projectId !== task.projectId || message.groupId !== task.groupId || message.channelThreadId !== reference.channelThreadId) errors.push(`${record.externalKey} has stale message evidence`)
    }
  }
  const suggestionStatusCounts = { accepted: 0, dismissed: 0, pending: 0 }
  const pendingSuggestionProjects = new Set<string>()
  for (const record of records.filter((candidate) => candidate.recordType === 'suggestions')) {
    const suggestion = await requireDocument(record.externalKey, 'taskSuggestions')
    if (!suggestion) continue
    if (suggestion.status === 'accepted') suggestionStatusCounts.accepted += 1
    else if (suggestion.status === 'dismissed') suggestionStatusCounts.dismissed += 1
    else if (suggestion.status === 'pending') {
      suggestionStatusCounts.pending += 1
      pendingSuggestionProjects.add(String(suggestion.projectId))
      if (
        suggestion.decidedAt !== undefined ||
        suggestion.decidedByProjectMemberId !== undefined ||
        suggestion.decisionActingCompanyId !== undefined ||
        suggestion.decisionIdempotencyKey !== undefined ||
        suggestion.decidedTaskId !== undefined ||
        suggestion.dismissalReason !== undefined ||
        suggestion.duplicateOverride !== undefined
      ) {
        errors.push(`${record.externalKey} has decision metadata while pending`)
      }
    } else {
      errors.push(`${record.externalKey} has unsupported status ${suggestion.status}`)
    }
    const references = await ctx.db.query('taskSuggestionReferences').withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestion._id)).collect()
    if (references.length !== 2) errors.push(`${record.externalKey} must cite two messages`)
  }
  if (suggestionStatusCounts.accepted !== 20 || suggestionStatusCounts.dismissed !== 5 || suggestionStatusCounts.pending !== 5) {
    errors.push(`suggestion status counts are ${JSON.stringify(suggestionStatusCounts)}`)
  }
  if (pendingSuggestionProjects.size !== 5) errors.push(`pending suggestions cover ${pendingSuggestionProjects.size} projects instead of 5`)
  for (const record of records.filter((candidate) => candidate.recordType === 'attachments')) {
    const attachment = await requireDocument(record.externalKey, 'attachments')
    if (!attachment) continue
    const message = await ctx.db.get(attachment.messageId)
    if (!message || message.projectId !== attachment.projectId || message.groupId !== attachment.groupId) {
      errors.push(`${record.externalKey} has incomplete message scope`)
      continue
    }
    if (!message.attachmentIds.includes(attachment._id)) errors.push(`${record.externalKey} is not linked from its message`)
  }
  return errors.slice(0, 50)
}

const heroProjectKeys = [
  'track-project-agency-campaign',
  'track-project-construction-coordination',
  'track-project-software-delivery',
  'track-project-exhibition-planning',
  'track-project-cross-functional-operations',
] as const

async function semanticVerification(ctx: ReadCtx, dataset: Doc<'showcaseDatasets'>) {
  const records = await ctx.db
    .query('showcaseDatasetRecords')
    .withIndex('by_dataset_organization', (q) =>
      q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId),
    )
    .collect()
  const projectRecords = records.filter((record) => record.recordType === 'projects')
  const datasetMessageIds = new Set(records
    .filter((record) => record.recordType === 'messages')
    .map((record) => record.recordId))
  const datasetTaskIds = new Set(records
    .filter((record) => record.recordType === 'tasks')
    .map((record) => record.recordId))
  const datasetSuggestionIds = new Set(records
    .filter((record) => record.recordType === 'suggestions')
    .map((record) => record.recordId))
  const datasetAttachmentIds = new Set(records
    .filter((record) => record.recordType === 'attachments')
    .map((record) => record.recordId))
  const firstLoadProjects = []
  for (const projectRecord of projectRecords) {
    const projectId = ctx.db.normalizeId('projects', projectRecord.recordId)
    if (!projectId) continue
    const projectMembers = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
    const firstProjectMember = projectMembers.find((member) => member.status === 'active')
    const firstGroupMembership = firstProjectMember
      ? await ctx.db.query('groupMembers').withIndex('by_project_member_status', (q) =>
        q.eq('projectMemberId', firstProjectMember._id).eq('status', 'active'),
      ).first()
      : null
    const firstGroup = firstGroupMembership ? await ctx.db.get(firstGroupMembership.groupId) : null
    const topLevelMessages = firstGroup
      ? await ctx.db.query('messages').withIndex('by_group_thread_created_at', (q) =>
        q.eq('groupId', firstGroup._id).eq('channelThreadId', undefined),
      ).order('desc').take(80)
      : []
    firstLoadProjects.push({
      projectKey: projectRecord.externalKey,
      projectId: projectRecord.recordId,
      firstGroup: firstGroup ? { groupId: String(firstGroup._id), name: firstGroup.name, kind: firstGroup.kind } : null,
      topLevelMessageCount: topLevelMessages.length,
    })
  }
  const messages = (await ctx.db.query('messages').collect()).filter((message) => datasetMessageIds.has(String(message._id)))
  const mentionMessageCount = messages.filter((message) => message.mentions.length > 0).length
  const mentionLinkCount = messages.reduce((total, message) => total + message.mentions.length, 0)
  const threadRecords = records.filter((record) => record.recordType === 'channelThreads')
  const threadSummaries = []
  let threadReplyCount = 0
  let invalidThreadRelationshipCount = 0
  for (const threadRecord of threadRecords) {
    const threadId = ctx.db.normalizeId('channelThreads', threadRecord.recordId)
    if (!threadId) {
      invalidThreadRelationshipCount += 1
      continue
    }
    const thread = await ctx.db.get(threadId)
    if (!thread) {
      invalidThreadRelationshipCount += 1
      continue
    }
    const [parent, allReplies] = await Promise.all([
      thread.sourceMessageId ? ctx.db.get(thread.sourceMessageId) : null,
      ctx.db.query('messages').withIndex('by_thread_created_at', (q) => q.eq('channelThreadId', threadId)).collect(),
    ])
    const replies = allReplies.filter((reply) => datasetMessageIds.has(String(reply._id)))
    threadReplyCount += replies.length
    if (!parent || parent.channelThreadId !== undefined || parent.groupId !== thread.groupId || replies.some((reply) =>
      reply.projectId !== thread.projectId || reply.groupId !== thread.groupId || reply.replyToMessageId !== parent._id,
    )) invalidThreadRelationshipCount += 1
    threadSummaries.push({
      threadId: String(threadId),
      projectId: String(thread.projectId),
      parentMessageId: parent ? String(parent._id) : null,
      replyCount: replies.length,
      parentMentionCount: parent?.mentions.length ?? 0,
    })
  }
  const heroes = []
  for (const [heroIndex, projectKey] of heroProjectKeys.entries()) {
    const projectRecord = projectRecords.find((record) => record.externalKey === projectKey)
    const projectId = projectRecord ? ctx.db.normalizeId('projects', projectRecord.recordId) : null
    const parentNumber = heroIndex * 40 + THREAD_PARENT_LOCAL_INDEX + 1
    const parentKey = `track-message-${String(parentNumber).padStart(4, '0')}`
    const parentId = await messageForKey(ctx, dataset, parentKey)
    const parent = await ctx.db.get(parentId)
    const threadRecord = await registryRecord(ctx, dataset.organizationId, threadKey(parentKey))
    const threadId = threadRecord ? ctx.db.normalizeId('channelThreads', threadRecord.recordId) : null
    const replies = threadId
      ? (await ctx.db.query('messages').withIndex('by_thread_created_at', (q) => q.eq('channelThreadId', threadId)).collect())
        .filter((reply) => datasetMessageIds.has(String(reply._id)))
      : []
    const projectTasks = projectId
      ? (await ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', projectId)).collect())
        .filter((task) => datasetTaskIds.has(String(task._id)))
      : []
    const projectSuggestions = projectId
      ? (await ctx.db.query('taskSuggestions').withIndex('by_project_status', (q) => q.eq('projectId', projectId)).collect())
        .filter((suggestion) => datasetSuggestionIds.has(String(suggestion._id)))
      : []
    const projectAttachments = projectId
      ? (await ctx.db.query('attachments').collect()).filter((attachment) =>
        attachment.projectId === projectId && datasetAttachmentIds.has(String(attachment._id)),
      )
      : []
    heroes.push({
      projectKey,
      firstLoad: firstLoadProjects.find((item) => item.projectKey === projectKey) ?? null,
      thread: {
        threadId: threadId ? String(threadId) : null,
        parentMessageId: String(parentId),
        replyCount: replies.length,
        parentMentionCount: parent?.mentions.length ?? 0,
        replyMentionCount: replies.reduce((total, reply) => total + reply.mentions.length, 0),
        linkedTaskCount: projectTasks.length,
        linkedSuggestionCount: projectSuggestions.length,
        linkedAttachmentCount: projectAttachments.length,
      },
    })
  }
  return {
    firstLoad: {
      projectCount: firstLoadProjects.length,
      populatedProjectCount: firstLoadProjects.filter((project) => project.topLevelMessageCount > 0).length,
      projects: firstLoadProjects,
    },
    mentions: { messageCount: mentionMessageCount, linkCount: mentionLinkCount },
    threads: {
      count: threadRecords.length,
      replyCount: threadReplyCount,
      invalidRelationshipCount: invalidThreadRelationshipCount,
      samples: threadSummaries.slice(0, 5),
    },
    heroes,
    reactions: {
      supported: false,
      reason: 'The current native Track schema has no reactions table or message reaction field.',
    },
  }
}

export const verify = internalQuery({
  args: {
    ...commonArgs,
    manifestHash: v.string(),
    assetManifestHash: v.string(),
    assetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const dataset = await datasetByOrganization(ctx, args.organizationId)
    if (!dataset || dataset.organizationKey !== args.organizationKey || dataset.product !== PRODUCT) {
      return { ok: false, status: 'missing', organizationId: null, counts: {}, assetCount: 0, relationshipErrors: ['showcase dataset is missing'] }
    }
    const counts: Record<string, number> = {}
    for (const recordType of manifestRecordTypes) counts[recordType] = await registryCount(ctx, dataset, recordType)
    const assetCount = (await ctx.db.query('showcaseDatasetAssets').withIndex('by_organization', (q) => q.eq('organizationId', dataset.organizationId)).collect()).length
    const relationship = await relationshipErrors(ctx, dataset)
    const semantic = await semanticVerification(ctx, dataset)
    const errors = [...relationship]
    const expectedRegistryCounts = {
      organization: expectedCounts.organizations,
      companies: expectedCounts.companies,
      users: expectedCounts.users,
      projects: expectedCounts.projects,
      memberships: expectedCounts.memberships,
      channels: expectedCounts.channels,
      messages: expectedCounts.messages,
      tasks: expectedCounts.tasks,
      suggestions: expectedCounts.suggestions,
      attachments: expectedCounts.attachments,
    }
    for (const [recordType, expected] of Object.entries(expectedRegistryCounts)) {
      if (counts[recordType] !== expected) errors.push(`${recordType} registry count is ${counts[recordType] ?? 0}, expected ${expected}`)
    }
    if (dataset.status !== 'applied') errors.push(`dataset status is ${dataset.status}`)
    if (args.manifestHash !== MANIFEST_HASH || dataset.manifestHash !== MANIFEST_HASH || dataset.manifestHash !== args.manifestHash) errors.push('manifest hash mismatch')
    if (args.assetManifestHash !== ASSET_MANIFEST_HASH || dataset.assetManifestHash !== ASSET_MANIFEST_HASH || dataset.assetManifestHash !== args.assetManifestHash) errors.push('asset manifest hash mismatch')
    if (assetCount !== 61 || assetCount !== args.assetCount) errors.push(`asset count is ${assetCount}, expected ${args.assetCount}`)
    if (semantic.firstLoad.projectCount !== expectedCounts.projects || semantic.firstLoad.populatedProjectCount !== expectedCounts.projects) {
      errors.push(`native first-load has ${semantic.firstLoad.populatedProjectCount}/${semantic.firstLoad.projectCount} populated projects`)
    }
    if (semantic.mentions.messageCount !== relationshipCounts.mentionMessages || semantic.mentions.linkCount !== relationshipCounts.mentionMessages) {
      errors.push(`native mention relationships are incomplete: ${JSON.stringify(semantic.mentions)}`)
    }
    if (semantic.threads.count !== relationshipCounts.channelThreads || semantic.threads.replyCount !== relationshipCounts.threadReplies || semantic.threads.invalidRelationshipCount !== 0) {
      errors.push(`native thread relationships are incomplete: ${JSON.stringify(semantic.threads)}`)
    }
    return {
      ok: errors.length === 0,
      status: dataset.status,
      organizationId: dataset.organizationId,
      counts,
      assetCount,
      relationshipErrors: errors,
      semantic,
    }
  },
})

export const beginRemove = internalMutation({
  args: { ...commonArgs, confirmOrganizationId: v.string() },
  handler: async (ctx, args) => {
    if (args.organizationId !== args.confirmOrganizationId) throw new Error('removal organization confirmation mismatch')
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey)
    if (dataset.status === 'removed') return { organizationId: dataset.organizationId, status: 'removed' as const }
    await assertNoUnregisteredProjectData(ctx, dataset)
    await ctx.db.patch(dataset._id, { status: 'removing', updatedAt: Date.now() })
    return { organizationId: dataset.organizationId, status: 'removing' as const }
  },
})

async function assertNoUnregisteredProjectData(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>) {
  const records = await ctx.db
    .query('showcaseDatasetRecords')
    .withIndex('by_dataset_organization', (q) =>
      q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId),
    )
    .collect()
  const registeredIds = (...recordTypes: string[]) => new Set(
    records
      .filter((record) => recordTypes.includes(record.recordType))
      .map((record) => record.recordId),
  )
  const registeredGroups = registeredIds('channels', 'generalChannels')
  const registeredMemberships = registeredIds('memberships')
  const registeredProjectCompanies = registeredIds('projectCompanies')
  const registeredMessages = registeredIds('messages')
  const registeredThreads = registeredIds('channelThreads')
  const registeredTasks = registeredIds('tasks')
  const registeredAttachments = registeredIds('attachments')
  const projectIds = records
    .filter((record) => record.recordType === 'projects')
    .map((record) => ctx.db.normalizeId('projects', record.recordId))
    .filter((id): id is Id<'projects'> => id !== null)

  for (const projectId of projectIds) {
    const groups = await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredGroup = groups.find((group) => !registeredGroups.has(String(group._id)))
    if (unregisteredGroup) throw new Error(`refusing removal with unregistered channel ${unregisteredGroup._id}`)

    const memberships = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredMembership = memberships.find((membership) => !registeredMemberships.has(String(membership._id)))
    if (unregisteredMembership) throw new Error(`refusing removal with unregistered project membership ${unregisteredMembership._id}`)

    const projectCompanies = await ctx.db.query('projectCompanies').withIndex('by_project_status', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredProjectCompany = projectCompanies.find((company) => !registeredProjectCompanies.has(String(company._id)))
    if (unregisteredProjectCompany) throw new Error(`refusing removal with unregistered project company ${unregisteredProjectCompany._id}`)

    const messages = await ctx.db.query('messages').withIndex('by_project_created_at', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredMessage = messages.find((message) => !registeredMessages.has(String(message._id)))
    if (unregisteredMessage) throw new Error(`refusing removal with unregistered message ${unregisteredMessage._id}`)

    const threads = await ctx.db.query('channelThreads').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredThread = threads.find((thread) => !registeredThreads.has(String(thread._id)))
    if (unregisteredThread) throw new Error(`refusing removal with unregistered channel thread ${unregisteredThread._id}`)

    const tasks = await ctx.db.query('tasks').withIndex('by_project_archived', (q) => q.eq('projectId', projectId)).collect()
    const unregisteredTask = tasks.find((task) => !registeredTasks.has(String(task._id)))
    if (unregisteredTask) throw new Error(`refusing removal with unregistered task ${unregisteredTask._id}`)

    for (const group of groups) {
      const attachments = await ctx.db.query('attachments').withIndex('by_group', (q) => q.eq('groupId', group._id)).collect()
      const unregisteredAttachment = attachments.find((attachment) => !registeredAttachments.has(String(attachment._id)))
      if (unregisteredAttachment) throw new Error(`refusing removal with unregistered attachment ${unregisteredAttachment._id}`)
    }
  }
}

async function deleteTaskDependentRows(ctx: WriteCtx, taskId: Id<'tasks'>) {
  const [references, followers, activities, labels, notifications, reminders] = await Promise.all([
    ctx.db.query('taskReferences').withIndex('by_task_rank', (q) => q.eq('taskId', taskId)).collect(),
    ctx.db.query('taskFollowers').withIndex('by_task_member', (q) => q.eq('taskId', taskId)).collect(),
    ctx.db.query('taskActivities').withIndex('by_task_created_at', (q) => q.eq('taskId', taskId)).collect(),
    ctx.db.query('taskLabelLinks').withIndex('by_task', (q) => q.eq('taskId', taskId)).collect(),
    ctx.db.query('taskNotifications').withIndex('by_task', (q) => q.eq('taskId', taskId)).collect(),
    ctx.db.query('taskReminderJobs').withIndex('by_task_status', (q) => q.eq('taskId', taskId)).collect(),
  ])
  for (const row of [...references, ...followers, ...activities, ...labels, ...notifications, ...reminders]) {
    await ctx.db.delete(row._id)
  }
}

async function deleteSuggestionDependentRows(ctx: WriteCtx, suggestionId: Id<'taskSuggestions'>) {
  const [references, hides] = await Promise.all([
    ctx.db.query('taskSuggestionReferences').withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestionId)).collect(),
    ctx.db.query('taskSuggestionHides').withIndex('by_suggestion', (q) => q.eq('suggestionId', suggestionId)).collect(),
  ])
  for (const row of [...references, ...hides]) await ctx.db.delete(row._id)
}

async function deleteNativeRegistryRecord(ctx: WriteCtx, record: RegistryRecord) {
  if (!record.owned) return
  if (record.recordType === 'showcaseDatasetAssets') {
    const id = ctx.db.normalizeId('showcaseDatasetAssets', record.recordId)
    if (!id) throw new Error(`invalid asset registry id ${record.externalKey}`)
    const asset = await ctx.db.get(id)
    if (asset) {
      await ctx.storage.delete(asset.storageId)
      await ctx.db.delete(id)
    }
    return
  }
  if (record.recordType === 'organization') return
  if (record.recordType === 'attachments') {
    const id = ctx.db.normalizeId('attachments', record.recordId)
    if (!id) throw new Error(`invalid attachment id ${record.externalKey}`)
    const attachment = await ctx.db.get(id)
    if (attachment) {
      await ctx.db.delete(id)
    }
    return
  }
  if (record.recordType === 'suggestions') {
    const id = ctx.db.normalizeId('taskSuggestions', record.recordId)
    if (!id) throw new Error(`invalid suggestion id ${record.externalKey}`)
    await deleteSuggestionDependentRows(ctx, id)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'tasks') {
    const id = ctx.db.normalizeId('tasks', record.recordId)
    if (!id) throw new Error(`invalid task id ${record.externalKey}`)
    await deleteTaskDependentRows(ctx, id)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'messages') {
    const id = ctx.db.normalizeId('messages', record.recordId)
    if (!id) throw new Error(`invalid message id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'channelThreads') {
    const id = ctx.db.normalizeId('channelThreads', record.recordId)
    if (!id) throw new Error(`invalid channel thread id ${record.externalKey}`)
    const [following, unfollowed, readStates] = await Promise.all([
      ctx.db.query('channelThreadFollowers').withIndex('by_thread_preference', (q) => q.eq('channelThreadId', id).eq('preference', 'following')).collect(),
      ctx.db.query('channelThreadFollowers').withIndex('by_thread_preference', (q) => q.eq('channelThreadId', id).eq('preference', 'unfollowed')).collect(),
      ctx.db.query('channelThreadReadStates').withIndex('by_thread_project_member', (q) => q.eq('channelThreadId', id)).collect(),
    ])
    for (const row of [...following, ...unfollowed, ...readStates]) await ctx.db.delete(row._id)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'channels' || record.recordType === 'generalChannels') {
    const id = ctx.db.normalizeId('groups', record.recordId)
    if (!id) throw new Error(`invalid channel id ${record.externalKey}`)
    const members = await ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', id)).collect()
    for (const member of members) await ctx.db.delete(member._id)
    const settings = (await ctx.db.query('groupNotificationSettings').collect()).filter((setting) => setting.groupId === id)
    for (const setting of settings) await ctx.db.delete(setting._id)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'memberships') {
    const id = ctx.db.normalizeId('projectMembers', record.recordId)
    if (!id) throw new Error(`invalid membership id ${record.externalKey}`)
    const members = (await ctx.db.query('groupMembers').collect()).filter((member) => member.projectMemberId === id)
    for (const member of members) await ctx.db.delete(member._id)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'projects') {
    const id = ctx.db.normalizeId('projects', record.recordId)
    if (!id) throw new Error(`invalid project id ${record.externalKey}`)
    const terms = (await Promise.all((['active', 'exit_pending', 'exited'] as const).map((status) =>
      ctx.db.query('projectCompanies').withIndex('by_project_status', (q) => q.eq('projectId', id).eq('status', status)).collect(),
    ))).flat()
    if (terms.length > 0) throw new Error(`refusing to delete project ${record.externalKey} with non-owned project companies`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'companyMembers') {
    const id = ctx.db.normalizeId('companyMembers', record.recordId)
    if (!id) throw new Error(`invalid company member id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'projectCompanies') {
    const id = ctx.db.normalizeId('projectCompanies', record.recordId)
    if (!id) throw new Error(`invalid project company id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'taskWorkflowStates') {
    const id = ctx.db.normalizeId('taskWorkflowStates', record.recordId)
    if (!id) throw new Error(`invalid workflow state id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'taskBoards') {
    const id = ctx.db.normalizeId('taskBoards', record.recordId)
    if (!id) throw new Error(`invalid task board id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'companies') {
    const id = ctx.db.normalizeId('companies', record.recordId)
    if (!id) throw new Error(`invalid company id ${record.externalKey}`)
    const members = await ctx.db.query('companyMembers').withIndex('by_company', (q) => q.eq('companyId', id)).collect()
    if (members.length > 0) throw new Error(`refusing to delete company ${record.externalKey} with non-owned members`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
    return
  }
  if (record.recordType === 'users') {
    const id = ctx.db.normalizeId('users', record.recordId)
    if (!id) throw new Error(`invalid user id ${record.externalKey}`)
    if (await ctx.db.get(id)) await ctx.db.delete(id)
  }
}

export const removeBatch = internalMutation({
  args: {
    ...commonArgs,
    confirmOrganizationId: v.string(),
    recordType: removalTypeValidator,
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.organizationId !== args.confirmOrganizationId) throw new Error('removal organization confirmation mismatch')
    const dataset = await requireRemovingDataset(ctx, args.organizationKey, args.organizationId)
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) throw new Error('removal batch limit must be between 1 and 50')
    const records = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_type', (q) =>
      q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId).eq('recordType', args.recordType),
    ).take(args.limit)
    for (const record of records) {
      await deleteNativeRegistryRecord(ctx, record)
      await ctx.db.delete(record._id)
    }
    const remaining = await registryCount(ctx, dataset, args.recordType)
    return { processed: records.length, remaining }
  },
})

export const finishRemove = internalMutation({
  args: { ...commonArgs, confirmOrganizationId: v.string() },
  handler: async (ctx, args) => {
    if (args.organizationId !== args.confirmOrganizationId) throw new Error('removal organization confirmation mismatch')
    const dataset = await requireRemovingDataset(ctx, args.organizationKey, args.organizationId)
    const records = await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization', (q) => q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId)).collect()
    if (records.length > 0) throw new Error(`showcase removal has ${records.length} registry records remaining`)
    const assets = await ctx.db.query('showcaseDatasetAssets').withIndex('by_organization', (q) => q.eq('organizationId', dataset.organizationId)).collect()
    for (const asset of assets) {
      await ctx.storage.delete(asset.storageId).catch(() => undefined)
      await ctx.db.delete(asset._id)
    }
    await ctx.db.patch(dataset._id, { status: 'removed', updatedAt: Date.now() })
    await ctx.db.delete(dataset._id)
    return { organizationId: dataset.organizationId, status: 'removed' as const }
  },
})
