import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { appendTaskActivity, rankForIndex } from './lib/taskData'

const DATASET_ID = 'showcase-v1'
const DATASET_VERSION = '1.0.0'
const PRODUCT = 'track'

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
const MANIFEST_HASH = 'sha256:3e3b8abf1f5f564536d4fdb6a1242795cddfa6deaf94b53c97644066f49ae3f9'
const ASSET_MANIFEST_HASH = 'sha256:998dc132963870223e798490630a33a140ba7cc6e9e950b37e10b9ccad48d7ae'

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
    const id = ctx.db.normalizeId('companyMembers', existingRegistry.recordId)
    if (!id) throw new Error('invalid company member registry record')
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
  if (existingRegistry) {
    const boardId = ctx.db.normalizeId('taskBoards', existingRegistry.recordId)
    if (!boardId) throw new Error('invalid task board registry record')
    return boardId
  }
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
  await registerRecord(ctx, {
    dataset,
    recordType: 'taskBoards',
    externalKey,
    recordId: String(boardId),
    owned: true,
  })
  const states = [
    ['Backlog', 'backlog', 'neutral'],
    ['To do', 'unstarted', 'blue'],
    ['In progress', 'started', 'amber'],
    ['Done', 'completed', 'green'],
    ['Canceled', 'canceled', 'neutral'],
  ] as const
  for (const [index, [name, category, visualToken]] of states.entries()) {
    const stateId = await ctx.db.insert('taskWorkflowStates', {
      projectId,
      boardId,
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
      externalKey: `${externalKey}:${category}`,
      recordId: String(stateId),
      owned: true,
    })
  }
  return boardId
}

async function workflowStateFor(
  ctx: ReadCtx,
  dataset: Doc<'showcaseDatasets'>,
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
  if (existing) return existing.recordId
  const ownerUser = await ownerUserId(ctx, dataset)
  const displayName = requiredString(record, 'displayName')
  const normalizedHandle = companyHandle(externalKey)
  const handleCollision = await ctx.db
    .query('companies')
    .withIndex('by_handle', (q) => q.eq('normalizedHandle', normalizedHandle))
    .unique()
  if (handleCollision) throw new Error(`company handle ${normalizedHandle} already exists`)
  const now = Date.now()
  const scene = await ctx.db
    .query('showcaseDatasetAssets')
    .withIndex('by_dataset_organization_asset', (q) =>
      q.eq('datasetId', DATASET_ID)
        .eq('organizationId', dataset.organizationId)
        .eq('assetKey', 'track/catalog/organization-scene'),
    )
    .unique()
  const companyId = await ctx.db.insert('companies', {
    displayName,
    normalizedHandle,
    logoStorageId: externalKey === 'track-company-mosaic-works' ? scene?.storageId : undefined,
    status: 'active',
    revision: 1,
    createdBy: ownerUser,
    createdAt: now,
    updatedAt: now,
  })
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
  if (existing) return existing.recordId
  const now = Date.now()
  let userId: Id<'users'>
  let owned = true
  if (useOwner) {
    userId = await ownerUserId(ctx, dataset)
    owned = false
  } else {
    const displayName = requiredString(record, 'displayNameEn')
    const email = `${externalKey}@showcase.track.invalid`
    userId = await ctx.db.insert('users', {
      googleSubject: `showcase:${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
      normalizedEmail: email,
      email,
      displayName,
      profileDesignation: optionalString(record, 'role'),
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
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
  if (existing) return existing.recordId
  const ownerUser = await ownerUserId(ctx, dataset)
  const companyId = await companyForKey(ctx, dataset, requiredString(record, 'companyKey'))
  const now = Date.now()
  const projectId = await ctx.db.insert('projects', {
    name: requiredString(record, 'name'),
    clientLabel: requiredString(record, 'domain'),
    description: `Fictional ${requiredString(record, 'domain')} project with scoped conversations, evidence, and tasks.`,
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
  await registerRecord(ctx, {
    dataset,
    recordType: 'projects',
    externalKey,
    recordId: String(projectId),
    owned: true,
  })
  const generalChannelId = await ctx.db.insert('groups', {
    projectId,
    kind: 'general',
    name: 'General',
    status: 'active',
    revision: 1,
    createdBy: ownerUser,
    createdAt: now,
    updatedAt: now,
  })
  await registerRecord(ctx, {
    dataset,
    recordType: 'generalChannels',
    externalKey: `__support:generalChannel:${externalKey}`,
    recordId: String(generalChannelId),
    owned: true,
  })
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
  await registerRecord(ctx, {
    dataset,
    recordType: 'projectCompanies',
    externalKey: `__support:projectCompany:${externalKey}`,
    recordId: String(projectCompanyId),
    owned: true,
  })
  return String(projectId)
}

async function applyMembership(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
  const projectKey = requiredString(record, 'projectKey')
  const userKey = requiredString(record, 'userKey')
  const projectId = await projectForKey(ctx, dataset, projectKey)
  const userId = await userForProjectKey(ctx, dataset, userKey, projectKey)
  const companyId = await companyForKey(ctx, dataset, requiredString(record, 'companyKey'))
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
  let projectCompany = await ctx.db
    .query('projectCompanies')
    .withIndex('by_project_status', (q) => q.eq('projectId', projectId).eq('status', 'active'))
    .filter((q) => q.eq(q.field('companyId'), companyId))
    .unique()
  if (!projectCompany) {
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
    await registerRecord(ctx, {
      dataset,
      recordType: 'projectCompanies',
      externalKey: `__support:projectCompany:${requiredString(record, 'projectKey')}:${requiredString(record, 'companyKey')}`,
      recordId: String(projectCompanyId),
      owned: true,
    })
    const project = await ctx.db.get(projectId)
    if (!project) throw new Error('project parent is missing')
    await ctx.db.patch(projectId, {
      origin: 'shared',
      participantRevision: (project.participantRevision ?? 1) + 1,
      revision: (project.revision ?? 1) + 1,
      updatedAt: now,
    })
    projectCompany = await ctx.db.get(projectCompanyId)
  }
  if (!projectCompany) throw new Error('project company parent is missing')
  const ownerUser = await ownerUserId(ctx, dataset)
  const now = Date.now()
  const projectMemberId = await ctx.db.insert('projectMembers', {
    projectId,
    userId,
    role: projectRole(requiredString(record, 'permission')),
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
  await registerRecord(ctx, {
    dataset,
    recordType: 'memberships',
    externalKey,
    recordId: String(projectMemberId),
    owned: true,
  })
  const generalChannel = (await ctx.db
    .query('groups')
    .withIndex('by_project', (q) => q.eq('projectId', projectId))
    .collect())
    .find((group) => group.kind === 'general')
  if (!generalChannel) throw new Error('general channel parent is missing')
  await ctx.db.insert('groupMembers', {
    projectId,
    groupId: generalChannel._id,
    userId,
    projectMemberId,
    status: 'active',
    isSteward: projectRole(requiredString(record, 'permission')) === 'manager',
    createdAt: now,
    updatedAt: now,
  })
  return String(projectMemberId)
}

async function applyChannel(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
  const projectId = await projectForKey(ctx, dataset, requiredString(record, 'projectKey'))
  const creatorId = await ownerUserId(ctx, dataset)
  const now = Date.now()
  const groupId = await ctx.db.insert('groups', {
    projectId,
    kind: 'custom',
    name: requiredString(record, 'name'),
    status: 'active',
    revision: 1,
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
  })
  await registerRecord(ctx, {
    dataset,
    recordType: 'channels',
    externalKey,
    recordId: String(groupId),
    owned: true,
  })
  const members = await ctx.db.query('projectMembers').withIndex('by_project', (q) => q.eq('projectId', projectId)).collect()
  for (const member of members) {
    await ctx.db.insert('groupMembers', {
      projectId,
      groupId,
      userId: member.userId,
      projectMemberId: member._id,
      status: 'active',
      isSteward: member.role === 'manager',
      createdAt: now,
      updatedAt: now,
    })
  }
  return String(groupId)
}

async function applyMessage(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
  const projectKey = requiredString(record, 'projectKey')
  const projectId = await projectForKey(ctx, dataset, projectKey)
  const groupId = await channelForKey(ctx, dataset, requiredString(record, 'channelKey'))
  const authorKey = requiredString(record, 'authorKey')
  const userId = await userForProjectKey(ctx, dataset, authorKey, projectKey)
  const member = await ctx.db.query('projectMembers').withIndex('by_project_user', (q) =>
    q.eq('projectId', projectId).eq('userId', userId),
  ).unique()
  if (!member) throw new Error(`message author is not a member of ${requiredString(record, 'projectKey')}`)
  const channel = await ctx.db.get(groupId)
  if (!channel || channel.projectId !== projectId) throw new Error('message channel scope mismatch')
  const number = Number(externalKey.replace('track-message-', ''))
  const channelSequence = Math.floor(((number - 1) % 40) / 3) + 1
  const now = parseDate(record, 'sentAt') + channelSequence
  const messageId = await ctx.db.insert('messages', {
    projectId,
    groupId,
    authorId: userId,
    authorProjectMemberId: member._id,
    actingCompanyId: member.companyId,
    channelSequence,
    idempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
    body: requiredString(record, 'body'),
    mentions: [],
    attachmentIds: [],
    createdAt: now,
  })
  await registerRecord(ctx, {
    dataset,
    recordType: 'messages',
    externalKey,
    recordId: String(messageId),
    owned: true,
  })
  return String(messageId)
}

async function applyTask(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
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
  const state = await workflowStateFor(ctx, dataset, boardId, taskStateCategory(requiredString(record, 'state')))
  const stateTasks = await ctx.db.query('tasks').withIndex('by_board_state_rank', (q) =>
    q.eq('boardId', boardId).eq('workflowStateId', state._id),
  ).collect()
  const now = parseDate(record, 'dueAt')
  const createdAt = sourceMessage.createdAt + 1000 + stateTasks.length
  const taskId = await ctx.db.insert('tasks', {
    projectId,
    publicKey: externalKey.replace('track-task-', 'TRK-').toUpperCase(),
    boardId,
    groupId: sourceMessage.groupId,
    workflowStateId: state._id,
    rank: rankForIndex(stateTasks.length),
    title: requiredString(record, 'title'),
    description: `Evidence-linked task from ${requiredString(record, 'sourceMessageKey')}.`,
    searchText: `${requiredString(record, 'title')} ${requiredString(record, 'state')}`,
    assigneeProjectMemberId: assignee._id,
    priority: taskPriority(Number(externalKey.replace('track-task-', ''))),
    dueDate: new Date(now).toISOString().slice(0, 10),
    createdByProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
    revision: 1,
    terminalAt: state.category === 'completed' ? createdAt : undefined,
    createIdempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
    createdAt,
    updatedAt: createdAt,
  })
  await registerRecord(ctx, {
    dataset,
    recordType: 'tasks',
    externalKey,
    recordId: String(taskId),
    owned: true,
  })
  await ctx.db.insert('taskReferences', {
    projectId,
    taskId,
    type: 'message',
    groupId: sourceMessage.groupId,
    messageId: sourceMessageId,
    quote: sourceMessage.body.slice(0, 280),
    availability: 'available',
    isPrimary: true,
    actorProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
    rank: rankForIndex(0),
    createdAt,
    updatedAt: createdAt,
  })
  await ctx.db.insert('taskFollowers', {
    projectId,
    taskId,
    userId: creatorMember.userId,
    projectMemberId: creator,
    reason: 'creator',
    enabled: true,
    createdAt,
    updatedAt: createdAt,
  })
  if (assignee._id !== creator) {
    await ctx.db.insert('taskFollowers', {
      projectId,
      taskId,
      userId: assignee.userId,
      projectMemberId: assignee._id,
      reason: 'assignee',
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    })
  }
  const task = await ctx.db.get(taskId)
  if (!task) throw new Error('task creation failed')
  await appendTaskActivity(ctx, {
    task,
    action: 'created',
    actorProjectMemberId: creator,
    actingCompanyId: creatorMember.companyId,
  })
  return String(taskId)
}

async function applySuggestion(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
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
  const now = Date.now()
  const suggestionId = await ctx.db.insert('taskSuggestions', {
    projectId: source.projectId,
    groupId: source.groupId,
    proposedTitle: task.title,
    proposedDescription: requiredString(record, 'explanation'),
    proposedAssigneeProjectMemberId: task.assigneeProjectMemberId,
    proposedPriority: task.priority,
    proposedDueDate: task.dueDate,
    status: accepted ? 'accepted' : 'dismissed',
    confidence: disposition === 'corrected' ? 0.86 : 0.92,
    groundingReason: requiredString(record, 'explanation'),
    fingerprint: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
    decidedByProjectMemberId: creator,
    decisionActingCompanyId: creatorMember.companyId,
    dismissalReason: accepted ? undefined : 'not_actionable',
    decidedTaskId: accepted ? taskId : undefined,
    duplicateOverride: disposition === 'corrected',
    decisionIdempotencyKey: `${DATASET_ID}:${dataset.organizationKey}:${externalKey}`,
    modelVersion: 'showcase-precomputed-v1',
    promptVersion: 'showcase-precomputed-v1',
    createdAt: now,
    updatedAt: now,
    decidedAt: now,
  })
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
    await ctx.db.insert('taskSuggestionReferences', {
      projectId: source.projectId,
      suggestionId,
      type: 'message',
      groupId: message.groupId,
      messageId,
      quote: message.body.slice(0, 280),
      availability: 'available',
      isPrimary: index === 0,
      rank: rankForIndex(index),
      createdAt: now,
      updatedAt: now,
    })
  }
  if (accepted) await ctx.db.patch(taskId, { sourceSuggestionId: suggestionId, updatedAt: now })
  return String(suggestionId)
}

async function applyAttachment(ctx: WriteCtx, dataset: Doc<'showcaseDatasets'>, record: ShowcaseRecord) {
  const externalKey = requiredString(record, 'externalKey')
  const existing = await registryRecord(ctx, dataset.organizationId, externalKey)
  if (existing) return existing.recordId
  const projectId = await projectForKey(ctx, dataset, requiredString(record, 'projectKey'))
  const messageId = await messageForKey(ctx, dataset, requiredString(record, 'messageKey'))
  const message = await ctx.db.get(messageId)
  if (!message || message.projectId !== projectId) throw new Error('attachment message scope mismatch')
  const asset = await assetForKey(ctx, dataset, requiredString(record, 'assetKey'))
  const metadata = asset.metadata
  const duration = metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata.duration === 'number'
    ? metadata.duration * 1000
    : undefined
  const kind = requiredString(record, 'kind') === 'voice-note' ? 'voice_note' as const : 'file' as const
  const filename = asset.storageKey.split('/').at(-1) ?? externalKey
  const attachmentId = await ctx.db.insert('attachments', {
    projectId,
    groupId: message.groupId,
    messageId,
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
  let skipped = 0
  for (const [index, value] of records.entries()) {
    const record = recordObject(value, `${recordType}[${index}]`)
    const externalKey = requiredString(record, 'externalKey')
    const prior = await registryRecord(ctx, dataset.organizationId, externalKey)
    let recordId: string
    if (prior) {
      recordId = prior.recordId
      skipped += 1
    } else {
      if (recordType === 'organizations') recordId = await applyOrganization(ctx, dataset, record)
      else if (recordType === 'companies') recordId = await applyCompany(ctx, dataset, record)
      else if (recordType === 'users') recordId = await applyUser(ctx, dataset, record, index === 0 && !(await ctx.db.query('showcaseDatasetRecords').withIndex('by_dataset_organization_type', (q) => q.eq('datasetId', DATASET_ID).eq('organizationId', dataset.organizationId).eq('recordType', 'users')).first()))
      else if (recordType === 'projects') recordId = await applyProject(ctx, dataset, record)
      else if (recordType === 'memberships') recordId = await applyMembership(ctx, dataset, record)
      else if (recordType === 'channels') recordId = await applyChannel(ctx, dataset, record)
      else if (recordType === 'messages') recordId = await applyMessage(ctx, dataset, record)
      else if (recordType === 'tasks') recordId = await applyTask(ctx, dataset, record)
      else if (recordType === 'suggestions') recordId = await applySuggestion(ctx, dataset, record)
      else if (recordType === 'attachments') recordId = await applyAttachment(ctx, dataset, record)
      else throw new Error(`unsupported Track record type ${recordType}`)
      inserted += 1
    }
    recordIds.push({ externalKey, recordId })
  }
  return { inserted, skipped, recordIds }
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
    if (owned) return { status: 'owned' as const, organizationId: owned.organizationId }
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
    ownerUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey)
    if (dataset.status === 'removing' || dataset.status === 'removed') {
      throw new Error('removed showcase datasets cannot be reapplied')
    }
    if (args.manifestHash !== MANIFEST_HASH || args.assetManifestHash !== ASSET_MANIFEST_HASH) throw new Error('showcase checksum mismatch')
    if (args.assetCount !== 61 || !hasExpectedCounts(args.counts)) throw new Error('showcase count contract mismatch')
    if (dataset.ownerUserId && dataset.ownerUserId !== args.ownerUserId) throw new Error('showcase owner user mismatch')
    await ctx.db.patch(dataset._id, {
      datasetVersion: args.datasetVersion,
      product: args.product,
      status: 'applying',
      counts: args.counts,
      assetCount: args.assetCount,
      manifestHash: args.manifestHash,
      assetManifestHash: args.assetManifestHash,
      ownerUserId: args.ownerUserId,
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
    const company = records.find((record) => record.recordType === 'companies' && String(project.proposingCompanyId) === record.recordId)
    if (!company) errors.push(`${projectRecord.externalKey} has no owned proposing company`)
    const terms = await ctx.db.query('projectCompanies').withIndex('by_project_status', (q) => q.eq('projectId', project._id).eq('status', 'active')).collect()
    if (terms.length === 0) errors.push(`${projectRecord.externalKey} has no active project company`)
    if (terms.length > 1 && project.origin !== 'shared') errors.push(`${projectRecord.externalKey} is not classified as shared`)
    const generalChannels = (await ctx.db.query('groups').withIndex('by_project', (q) => q.eq('projectId', project._id)).collect())
      .filter((group) => group.kind === 'general')
    if (generalChannels.length !== 1) errors.push(`${projectRecord.externalKey} must have one General channel`)
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
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'tasks')) {
    const task = await requireDocument(record.externalKey, 'tasks')
    if (!task) continue
    const source = await ctx.db.query('taskReferences').withIndex('by_task_rank', (q) => q.eq('taskId', task._id)).collect()
    if (!source.some((reference) => reference.type === 'message' && reference.messageId)) errors.push(`${record.externalKey} has no message evidence`)
  }
  for (const record of records.filter((candidate) => candidate.recordType === 'suggestions')) {
    const suggestionId = ctx.db.normalizeId('taskSuggestions', record.recordId)
    if (!suggestionId) {
      errors.push(`invalid suggestion ${record.externalKey}`)
      continue
    }
    const references = await ctx.db.query('taskSuggestionReferences').withIndex('by_suggestion_rank', (q) => q.eq('suggestionId', suggestionId)).collect()
    if (references.length !== 2) errors.push(`${record.externalKey} must cite two messages`)
  }
  return errors.slice(0, 50)
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
    const errors = [...relationship]
    if (dataset.status !== 'applied') errors.push(`dataset status is ${dataset.status}`)
    if (args.manifestHash !== MANIFEST_HASH || dataset.manifestHash !== MANIFEST_HASH || dataset.manifestHash !== args.manifestHash) errors.push('manifest hash mismatch')
    if (args.assetManifestHash !== ASSET_MANIFEST_HASH || dataset.assetManifestHash !== ASSET_MANIFEST_HASH || dataset.assetManifestHash !== args.assetManifestHash) errors.push('asset manifest hash mismatch')
    if (assetCount !== 61 || assetCount !== args.assetCount) errors.push(`asset count is ${assetCount}, expected ${args.assetCount}`)
    return {
      ok: errors.length === 0,
      status: dataset.status,
      organizationId: dataset.organizationId,
      counts,
      assetCount,
      relationshipErrors: errors,
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
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'removing')
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
    const dataset = await requireDataset(ctx, args.organizationId, args.organizationKey, 'removing')
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
