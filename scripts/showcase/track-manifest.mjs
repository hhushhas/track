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
  if (!manifest.organizationPolicy?.requiresExplicitKey || !manifest.organizationPolicy?.createNewOnly || !manifest.organizationPolicy?.rejectsExistingCustomer || !manifest.organizationPolicy?.productionConfirmationRequired || !manifest.organizationPolicy?.removalConfirmationRequired) errors.push('organization safety policy is incomplete')
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
  assertReferences(manifest, errors)
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
