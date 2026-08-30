import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const packRoot = join(repositoryRoot, 'showcase-data/showcase-v1')
const manifestPath = join(packRoot, 'track.json')
const assetManifestPath = join(packRoot, 'track-assets.json')
const checksumPath = join(packRoot, 'checksums.json')

export const EXPECTED_COUNTS = Object.freeze({
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

export const EXPECTED_RELATIONSHIP_COUNTS = Object.freeze({
  channelThreads: 20,
  threadReplies: 40,
  mentionMessages: 200,
})

export const RECORD_TYPE_ORDER = Object.freeze([
  'organizations',
  'companies',
  'users',
  'projects',
  'memberships',
  'channels',
  'messages',
  'tasks',
  'suggestions',
  'attachments',
])

const sha256File = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

export const loadTrackPack = () => ({
  manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  assetManifest: JSON.parse(readFileSync(assetManifestPath, 'utf8')),
  checksums: JSON.parse(readFileSync(checksumPath, 'utf8')),
  manifestPath,
  assetManifestPath,
})

function collectExternalKeys(records, type, errors) {
  const seen = new Set()
  for (const [index, record] of records.entries()) {
    if (!isNonEmptyString(record.externalKey)) errors.push(`${type}[${index}] is missing externalKey`)
    else if (seen.has(record.externalKey)) errors.push(`${type} has duplicate externalKey ${record.externalKey}`)
    seen.add(record.externalKey)
  }
}

function assertReferences(manifest, errors) {
  const records = manifest.records
  const keys = (type) => new Set(records[type].map((record) => record.externalKey))
  const organizations = keys('organizations')
  const companies = keys('companies')
  const users = keys('users')
  const projects = keys('projects')
  const channels = keys('channels')
  const messages = keys('messages')
  const tasks = keys('tasks')
  const check = (set, value, path) => {
    if (!set.has(value)) errors.push(`${path} references unknown ${value}`)
  }
  for (const [index, record] of records.companies.entries()) check(organizations, record.organizationKey, `companies[${index}].organizationKey`)
  for (const [index, record] of records.users.entries()) {
    check(organizations, record.organizationKey, `users[${index}].organizationKey`)
    check(companies, record.companyKey, `users[${index}].companyKey`)
  }
  for (const [index, record] of records.projects.entries()) {
    check(organizations, record.organizationKey, `projects[${index}].organizationKey`)
    check(companies, record.companyKey, `projects[${index}].companyKey`)
  }
  for (const [index, record] of records.memberships.entries()) {
    check(organizations, record.organizationKey, `memberships[${index}].organizationKey`)
    check(projects, record.projectKey, `memberships[${index}].projectKey`)
    check(users, record.userKey, `memberships[${index}].userKey`)
  }
  for (const [index, record] of records.channels.entries()) {
    check(organizations, record.organizationKey, `channels[${index}].organizationKey`)
    check(projects, record.projectKey, `channels[${index}].projectKey`)
  }
  for (const [index, record] of records.messages.entries()) {
    check(organizations, record.organizationKey, `messages[${index}].organizationKey`)
    check(projects, record.projectKey, `messages[${index}].projectKey`)
    check(channels, record.channelKey, `messages[${index}].channelKey`)
    check(users, record.authorKey, `messages[${index}].authorKey`)
  }
  for (const [index, record] of records.tasks.entries()) {
    check(organizations, record.organizationKey, `tasks[${index}].organizationKey`)
    check(projects, record.projectKey, `tasks[${index}].projectKey`)
    check(messages, record.sourceMessageKey, `tasks[${index}].sourceMessageKey`)
    check(users, record.assigneeKey, `tasks[${index}].assigneeKey`)
  }
  for (const [index, record] of records.suggestions.entries()) {
    check(organizations, record.organizationKey, `suggestions[${index}].organizationKey`)
    check(projects, record.projectKey, `suggestions[${index}].projectKey`)
    check(tasks, record.suggestedTaskKey, `suggestions[${index}].suggestedTaskKey`)
    for (const [sourceIndex, sourceKey] of record.sourceMessageKeys.entries()) check(messages, sourceKey, `suggestions[${index}].sourceMessageKeys[${sourceIndex}]`)
  }
  for (const [index, record] of records.attachments.entries()) {
    check(organizations, record.organizationKey, `attachments[${index}].organizationKey`)
    check(projects, record.projectKey, `attachments[${index}].projectKey`)
    check(messages, record.messageKey, `attachments[${index}].messageKey`)
  }
}

function assertSuggestionDispositions(manifest, errors) {
  const suggestions = manifest.records.suggestions
  const allowed = new Set(['accepted', 'corrected', 'rejected', 'pending'])
  for (const [index, suggestion] of suggestions.entries()) {
    if (!allowed.has(suggestion.disposition)) errors.push(`suggestions[${index}] has an unsupported disposition`)
  }
  for (const pack of manifest.targetedPacks ?? []) {
    if (!suggestions.some((suggestion) => suggestion.projectKey === pack.projectKey && suggestion.disposition === 'pending')) {
      errors.push(`${pack.projectKey} must have a pending suggestion for Inbox dogfood`)
    }
  }
  for (const disposition of ['accepted', 'corrected', 'rejected']) {
    if (!suggestions.some((suggestion) => suggestion.disposition === disposition)) {
      errors.push(`Track must preserve ${disposition} suggestion history`)
    }
  }
}

const forbiddenFixtureText = /Track showcase mention|Track thread follow-up|Evidence-linked task from|track-message-\d{4}/i
const compactText = (value) => String(value).replace(/\s+/g, ' ').trim()
const contentKindLabels = Object.freeze({
  status: 'status update',
  decision: 'decision',
  delay: 'delay',
  approval: 'approval',
  evidence: 'evidence',
  handoff: 'handoff',
})

function assertContentContracts(manifest, assetManifest, errors) {
  const records = manifest.records
  const projects = new Map(records.projects.map((project) => [project.externalKey, project]))
  const messages = new Map(records.messages.map((message) => [message.externalKey, message]))
  const voiceTranscripts = new Set()
  for (const [index, message] of records.messages.entries()) {
    if (forbiddenFixtureText.test(message.body)) errors.push(`messages[${index}] exposes internal fixture text`)
    if (/\bday\(s\)\b/i.test(message.body) || /\b1 days\b/i.test(message.body) || /\b(?:[2-9]|10) day\b/i.test(message.body)) {
      errors.push(`messages[${index}] has ungrammatical English delay wording`)
    }
    if (/(?:^|[^\d])(?:[1-9]|10)\s+يوم(?![\p{L}])/u.test(message.body)) {
      errors.push(`messages[${index}] has ungrammatical Arabic delay wording`)
    }
    if (message.locale === 'en-US' && /[.!?]\s+[a-z]/.test(message.body)) {
      errors.push(`messages[${index}] starts a sentence with lowercase text`)
    }
    const project = projects.get(message.projectKey)
    if (!project || !Number.isFinite(Date.parse(project.startsAt)) || !Number.isFinite(Date.parse(message.sentAt))) {
      errors.push(`messages[${index}] has an invalid project chronology reference`)
    } else if (Date.parse(message.sentAt) < Date.parse(project.startsAt)) {
      errors.push(`messages[${index}] precedes its project start`)
    }
  }
  for (const project of records.projects) {
    const projectMessages = records.messages
      .filter((message) => message.projectKey === project.externalKey)
      .sort((left, right) => left.externalKey.localeCompare(right.externalKey, 'en', { numeric: true }))
    for (let index = 1; index < projectMessages.length; index += 1) {
      if (Date.parse(projectMessages[index - 1].sentAt) >= Date.parse(projectMessages[index].sentAt)) {
        errors.push(`${project.externalKey} messages are not chronological`)
        break
      }
    }
    const parent = projectMessages.find((message) => message.externalKey.endsWith('0013') || Number(message.externalKey.replace('track-message-', '')) % 40 === 13)
    if (!parent) {
      errors.push(`${project.externalKey} is missing its thread parent`)
      continue
    }
    const parentNumber = Number(parent.externalKey.replace('track-message-', ''))
    const replies = [messages.get(`track-message-${String(parentNumber + 3).padStart(4, '0')}`), messages.get(`track-message-${String(parentNumber + 6).padStart(4, '0')}`)]
    const narrativeToken = compactText(parent.body).slice(0, 48).toLocaleLowerCase()
    for (const [replyIndex, reply] of replies.entries()) {
      if (!reply || !compactText(reply.body).toLocaleLowerCase().includes(narrativeToken)) {
        errors.push(`${project.externalKey} thread reply ${replyIndex + 1} is not grounded in its parent narrative`)
      }
      if (reply && Date.parse(reply.sentAt) <= Date.parse(parent.sentAt)) errors.push(`${project.externalKey} thread reply ${replyIndex + 1} precedes its parent`)
    }
  }
  const replyMessages = records.messages.filter((message) => [15, 18].includes((Number(message.externalKey.replace('track-message-', '')) - 1) % 40))
  const replyTemplates = new Set(replyMessages.map((message) => compactText(message.body).split(': ')[0]))
  if (replyTemplates.size < 8) errors.push(`Track thread reply template diversity is too low: ${replyTemplates.size}`)
  for (const suggestion of records.suggestions) {
    if (/\ba Atlas Mobile Release task\b/i.test(String(suggestion.explanation))) {
      errors.push(`${suggestion.externalKey} uses the incorrect indefinite article before Atlas Mobile Release`)
    }
  }
  if (!Array.isArray(manifest.assetRecipes) || manifest.assetRecipes.length !== 61) {
    errors.push('Track must define 61 asset recipes')
  }
  for (const [index, recipe] of (manifest.assetRecipes ?? []).entries()) {
    if (typeof recipe.body !== 'string' || compactText(recipe.body).length === 0) errors.push(`assetRecipes[${index}] is missing a description`)
    if (typeof recipe.body === 'string' && forbiddenFixtureText.test(recipe.body)) errors.push(`assetRecipes[${index}] exposes an internal key or fixture phrase`)
    if (recipe.category !== 'voice-note') continue
    const source = messages.get(recipe.relationships?.messageKey)
    const expectedKind = source ? contentKindLabels[source.contentKind] : undefined
    if (!source || !expectedKind || !String(recipe.body).toLocaleLowerCase().includes(expectedKind)) {
      errors.push(`assetRecipes[${index}] voice description does not match its source content kind`)
    }
    if (/confirms the referenced delay/i.test(String(recipe.body))) errors.push(`assetRecipes[${index}] uses the generic delay description`)
  }
  for (const [index, asset] of assetManifest.assets.entries()) {
    if (typeof asset.body !== 'string' || compactText(asset.body).length === 0) errors.push(`assets[${index}] is missing a metadata body`)
    if (typeof asset.body === 'string' && forbiddenFixtureText.test(asset.body)) errors.push(`assets[${index}] exposes internal fixture text in its metadata body`)
    if (asset.category !== 'voice-note') {
      continue
    }
    const transcript = typeof asset.transcript === 'string' ? asset.transcript : ''
    if (transcript.length === 0 || voiceTranscripts.has(transcript)) errors.push(`assets[${index}] has a missing or duplicate voice transcript`)
    voiceTranscripts.add(transcript)
    if (!Array.isArray(asset.speakers) || asset.speakers.length < 3 || asset.speakers.some((speaker) => /synthetic narrator/i.test(String(speaker)))) {
      errors.push(`assets[${index}] does not identify several believable voice speakers`)
    }
    if (!Array.isArray(asset.captions) || asset.captions.length < 3) errors.push(`assets[${index}] has too few voice caption segments`)
    if (/day\(s\)/i.test(transcript)) errors.push(`assets[${index}] has ungrammatical delay wording in its transcript`)
    if (forbiddenFixtureText.test(transcript)) errors.push(`assets[${index}] exposes internal fixture text in its transcript`)
    const source = messages.get(asset.relationships?.messageKey)
    if (!source || !compactText(transcript).toLocaleLowerCase().includes(compactText(source.body).slice(0, 36).toLocaleLowerCase())) {
      errors.push(`assets[${index}] voice transcript is not specific to its source message`)
    }
  }
}

function assetPath(assetRoot, asset) {
  const local = asset.localPath.replace(/^build\/assets\/track\//, '')
  const candidates = assetRoot
    ? [join(assetRoot, 'track', local), join(assetRoot, local)]
    : []
  candidates.push(join(packRoot, 'assets', local))
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

export function validateTrackPack({ assetRoot } = {}) {
  const { manifest, assetManifest, checksums } = loadTrackPack()
  const errors = []
  const manifestHash = sha256File(manifestPath)
  const assetManifestHash = sha256File(assetManifestPath)
  if (checksums.datasetId !== 'showcase-v1' || checksums.datasetVersion !== '1.0.0' || checksums.product !== 'track' || checksums.algorithm !== 'sha256') errors.push('vendored checksum contract identity is invalid')
  if (checksums.manifest?.contentHash !== manifestHash) errors.push(`vendored manifest checksum mismatch: expected ${checksums.manifest?.contentHash ?? 'missing'}, got ${manifestHash}`)
  if (checksums.assets?.contentHash !== assetManifestHash) errors.push(`vendored asset-manifest checksum mismatch: expected ${checksums.assets?.contentHash ?? 'missing'}, got ${assetManifestHash}`)
  if (manifest.schemaVersion !== 1 || manifest.datasetId !== 'showcase-v1' || manifest.datasetVersion !== '1.0.0' || manifest.product !== 'track') errors.push('Track manifest identity must be showcase-v1/1.0.0/track')
  if (!manifest.organizationPolicy?.requiresExplicitKey || manifest.organizationPolicy.createNewOnly !== false || !manifest.organizationPolicy?.repairExistingOnly || !manifest.organizationPolicy?.rejectsExistingCustomer || !manifest.organizationPolicy?.productionConfirmationRequired || !manifest.organizationPolicy?.removalConfirmationRequired) errors.push('organization safety policy is incomplete')
  for (const type of RECORD_TYPE_ORDER) {
    const records = manifest.records?.[type]
    if (!Array.isArray(records)) {
      errors.push(`records.${type} must be an array`)
      continue
    }
    if (records.length !== EXPECTED_COUNTS[type]) errors.push(`records.${type} count must be ${EXPECTED_COUNTS[type]}`)
    collectExternalKeys(records, type, errors)
  }
  if (manifest.targetedPacks?.length !== 5) errors.push('Track must define five targeted packs')
  const uniqueBodies = new Set(manifest.records.messages.map((record) => record.body))
  if (uniqueBodies.size !== EXPECTED_COUNTS.messages) errors.push('Track messages must have unique bodies')
  const localeCounts = manifest.records.messages.reduce((counts, record) => ({
    ...counts,
    [record.locale]: (counts[record.locale] ?? 0) + 1,
  }), {})
  if ((localeCounts['ar-en'] ?? 0) < 200 || (localeCounts['ar-SA'] ?? 0) < 200 || (localeCounts['en-US'] ?? 0) < 200) errors.push(`Track locale coverage is too shallow: ${JSON.stringify(localeCounts)}`)
  const heroProjects = manifest.records.projects.filter((record) => record.golden === true)
  if (heroProjects.length !== 5 || heroProjects.some((record) => record.status !== 'active')) errors.push('all five Track hero projects must be active')
  const relationshipPolicy = manifest.relationshipPolicy
  if (
    relationshipPolicy?.defaultScopeMessageCountPerProject !== 6 ||
    relationshipPolicy?.threadParentLocalIndex !== 12 ||
    JSON.stringify(relationshipPolicy?.threadReplyLocalIndices) !== JSON.stringify([15, 18]) ||
    relationshipPolicy?.mentionEveryNthMessage !== 4
  ) errors.push('Track relationship policy is incomplete')
  assertReferences(manifest, errors)
  assertSuggestionDispositions(manifest, errors)
  assertContentContracts(manifest, assetManifest, errors)
  if (assetManifest.datasetId !== manifest.datasetId || assetManifest.datasetVersion !== manifest.datasetVersion || assetManifest.product !== manifest.product) errors.push('asset manifest identity does not match Track manifest')
  if (assetManifest.assets.length !== 61) errors.push('Track must define 61 assets')
  const assetKeys = new Set()
  const checkedAssets = []
  for (const [index, asset] of assetManifest.assets.entries()) {
    if (!isNonEmptyString(asset.assetKey) || assetKeys.has(asset.assetKey)) errors.push(`assets[${index}] has a missing or duplicate asset key`)
    assetKeys.add(asset.assetKey)
    if (!/^sha256:[0-9a-f]{64}$/.test(asset.contentHash)) errors.push(`assets[${index}] has invalid checksum`)
    if (asset.status !== 'built') errors.push(`assets[${index}] is not built`)
    if (!isNonEmptyString(asset.localPath) || !isNonEmptyString(asset.storageKey)) errors.push(`assets[${index}] is missing a path or storage key`)
    if (!assetRoot) continue
    if (!isAbsolute(assetRoot)) {
      errors.push('assetRoot must be an absolute path')
      break
    }
    const path = assetPath(assetRoot, asset)
    if (!path || !existsSync(path)) {
      errors.push(`asset file is missing for ${asset.assetKey}`)
      continue
    }
    const rootRelative = relative(normalize(assetRoot), normalize(path))
    if (rootRelative.startsWith('..') || isAbsolute(rootRelative)) {
      errors.push(`asset path escapes assetRoot for ${asset.assetKey}`)
      continue
    }
    const actualHash = sha256File(path)
    if (actualHash !== asset.contentHash) errors.push(`checksum mismatch for ${asset.assetKey}: expected ${asset.contentHash}, got ${actualHash}`)
    checkedAssets.push({ assetKey: asset.assetKey, path, contentHash: actualHash, fileSize: statSync(path).size, filename: basename(path) })
  }
  return { manifest, assetManifest, checksums, errors, ok: errors.length === 0, checkedAssets, manifestHash, assetManifestHash }
}

export { assetManifestPath, checksumPath, manifestPath }
