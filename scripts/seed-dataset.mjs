#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EXPECTED_COUNTS,
  RECORD_TYPE_ORDER,
  validateTrackPack,
} from './showcase/track-manifest.mjs'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const ENVIRONMENTS = Object.freeze({
  local: { webBaseUrl: 'http://localhost:3000' },
  'hosted-dev': {
    deployment: 'enduring-impala-781',
    webBaseUrl: 'https://dev.track.q9labs.ai',
  },
  production: { webBaseUrl: 'https://track.q9labs.ai' },
})

const usage = `Usage:
  pnpm seed:dataset plan   --pack showcase-v1 --environment <local|hosted-dev|production> --organization-key <new-key>
  pnpm seed:dataset apply  --pack showcase-v1 --environment <local|hosted-dev|production> --organization-key <new-key> --create-organization --confirm-production --owner-user-id <id> --asset-root <absolute-path>
  pnpm seed:dataset verify --pack showcase-v1 --environment <local|hosted-dev|production> --organization-key <new-key> --organization-id <id> --asset-root <absolute-path>
  pnpm seed:dataset remove --pack showcase-v1 --environment <local|hosted-dev|production> --organization-key <new-key> --confirm-organization <resolved-id>

Production apply and remove require --confirm-production. Remove requires the exact resolved organization id.
`

function fail(message, code = 2) {
  console.error(`seed:dataset: ${message}`)
  console.error(usage)
  process.exitCode = code
}

function parseArgs(argv) {
  const [mode, ...rest] = argv
  const options = { mode }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) throw new Error(`unexpected argument ${token}`)
    const key = token.slice(2)
    if (['create-organization', 'confirm-production', 'json'].includes(key)) {
      options[key] = true
      continue
    }
    const value = rest[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${key}`)
    options[key] = value
    index += 1
  }
  return options
}

function requireOptions(options) {
  if (!new Set(['plan', 'apply', 'verify', 'remove']).has(options.mode)) throw new Error(`unknown mode ${options.mode ?? ''}`)
  if (options.pack !== 'showcase-v1') throw new Error('--pack must be showcase-v1')
  if (!Object.hasOwn(ENVIRONMENTS, options.environment)) throw new Error('--environment must be explicit: local, hosted-dev, or production')
  if (typeof options['organization-key'] !== 'string' || options['organization-key'].trim() === '') throw new Error('--organization-key is required')
  const organizationKey = options['organization-key'].trim()
  if (organizationKey === '*' || organizationKey.includes('*') || organizationKey.includes('?') || /^(all|unknown|null|undefined)$/i.test(organizationKey)) throw new Error('wildcard and sentinel organization keys are not allowed')
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(organizationKey)) throw new Error('organization key must match ^[a-z][a-z0-9-]{2,63}$')
  if (options.environment === 'production' && ['apply', 'remove'].includes(options.mode) && options['confirm-production'] !== true) throw new Error(`production ${options.mode} requires --confirm-production`)
  if (options.mode === 'apply' && options['create-organization'] !== true) throw new Error('apply requires --create-organization')
  if (options.mode === 'apply' && typeof options['owner-user-id'] !== 'string') throw new Error('apply requires --owner-user-id <id>')
  if (options.mode === 'remove' && typeof options['confirm-organization'] !== 'string') throw new Error('remove requires --confirm-organization <resolved-id>')
  if (['apply', 'verify'].includes(options.mode)) {
    if (typeof options['asset-root'] !== 'string') throw new Error(`${options.mode} requires --asset-root <absolute-path>`)
    if (!isAbsolute(options['asset-root'])) throw new Error('--asset-root must be an absolute path')
  }
  if (options.mode === 'verify' && typeof options['organization-id'] !== 'string') throw new Error('verify requires --organization-id <id>')
  return { ...options, organizationKey }
}

function convexTarget(options) {
  const environment = ENVIRONMENTS[options.environment]
  const deployment = options.deployment ?? process.env.CONVEX_DEPLOYMENT ?? environment.deployment
  if (deployment) return deployment
  throw new Error('no explicit Convex target; pass --deployment or CONVEX_DEPLOYMENT')
}

function runConvex(options, functionName, args) {
  const deployment = convexTarget(options)
  const commandArgs = ['exec', 'convex', 'run']
  commandArgs.push('--deployment', deployment)
  commandArgs.push('--typecheck', 'disable', '--codegen', 'disable')
  commandArgs.push(functionName, JSON.stringify(args))
  const output = execFileSync('pnpm', commandArgs, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  const trimmed = output.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((index) => index >= 0)
    if (starts.length === 0) throw new Error(`Convex ${functionName} returned no JSON: ${trimmed.slice(-500)}`)
    return JSON.parse(trimmed.slice(Math.min(...starts)))
  }
}

function printCounts(validation) {
  console.log('Track showcase-v1 dataset')
  console.log(`  records: ${JSON.stringify(EXPECTED_COUNTS)}`)
  console.log(`  assets: ${validation.assetManifest.assets.length} (built=${validation.assetManifest.counts.built}, pending=${validation.assetManifest.counts.pendingProductCapture})`)
  console.log(`  manifest anchor: ${validation.manifest.anchorDate}`)
}

function companyHandles(manifest) {
  return manifest.records.companies.map((record) => record.externalKey.replace(/^track-company-/, ''))
}

function presenterLinks(options, manifest, ids) {
  const environment = ENVIRONMENTS[options.environment]
  const companyByKey = new Map(manifest.records.companies.map((record, index) => [record.externalKey, ids.companies[index]]))
  const projectByKey = new Map(manifest.records.projects.map((record, index) => [record.externalKey, ids.projects[index]]))
  const channelByKey = new Map(manifest.records.channels.map((record, index) => [record.externalKey, ids.channels[index]]))
  const membershipByKey = new Map(manifest.records.memberships.map((record, index) => [record.externalKey, ids.memberships[index]]))
  return manifest.targetedPacks.map((pack) => {
    const project = manifest.records.projects.find((record) => record.externalKey === pack.projectKey)
    const manager = manifest.records.memberships.find((record) => record.projectKey === pack.projectKey && record.permission === 'manage')
    const projectId = projectByKey.get(pack.projectKey)
    const companyId = project ? companyByKey.get(project.companyKey) : undefined
    const groupId = channelByKey.get(pack.entryCaseKey)
    const membershipId = manager ? membershipByKey.get(manager.externalKey) : undefined
    const query = new URLSearchParams({ companyId, groupId, membershipId })
    return {
      packKey: pack.packKey,
      entryCaseKey: pack.entryCaseKey,
      entryLink: `${environment.webBaseUrl}/workspace/company-projects/${projectId}?${query}`,
      projectId,
      companyId,
      groupId,
      membershipId,
    }
  })
}

async function uploadAssets(options, validation, organizationId) {
  const storageIds = []
  for (const asset of validation.assetManifest.assets) {
    const checked = validation.checkedAssets.find((candidate) => candidate.assetKey === asset.assetKey)
    if (!checked || checked.contentHash !== asset.contentHash) throw new Error(`refusing to upload unchecked asset ${asset.assetKey}`)
    const upload = runConvex(options, 'showcaseDataset:generateAssetUploadUrl', {
      datasetId: validation.manifest.datasetId,
      organizationKey: options.organizationKey,
      organizationId,
      assetKey: asset.assetKey,
    })
    if (upload.reused === true && typeof upload.storageId === 'string') {
      storageIds.push(upload.storageId)
      continue
    }
    if (typeof upload.uploadUrl !== 'string') throw new Error(`Convex returned no upload URL for ${asset.assetKey}`)
    const uploadResponse = await fetch(upload.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': asset.mimeType },
      body: await readFile(checked.path),
    })
    if (!uploadResponse.ok) throw new Error(`asset upload failed for ${asset.assetKey}: ${uploadResponse.status}`)
    const body = await uploadResponse.json()
    if (typeof body.storageId !== 'string') throw new Error(`asset upload returned no storage id for ${asset.assetKey}`)
    storageIds.push(body.storageId)
  }
  return storageIds
}

async function applyPack(options, validation) {
  const { manifest } = validation
  const resolved = runConvex(options, 'showcaseDataset:resolveOrganization', {
    datasetId: manifest.datasetId,
    product: manifest.product,
    organizationKey: options.organizationKey,
    companyHandles: companyHandles(manifest),
  })
  if (resolved.status === 'existing-customer') throw new Error(`refusing existing customer organization ${resolved.organizationId ?? ''}`)
  let organizationId = resolved.organizationId
  if (resolved.status === 'missing') {
    const created = runConvex(options, 'showcaseDataset:createOrganization', {
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      product: manifest.product,
      organizationKey: options.organizationKey,
      displayName: manifest.records.organizations[0].displayName,
      ownerUserId: options['owner-user-id'],
      companyHandles: companyHandles(manifest),
    })
    organizationId = created.organizationId
  }
  if (typeof organizationId !== 'string' || organizationId.length === 0) throw new Error('Convex did not resolve a concrete organization id')
  if (!options.json) console.log(`Resolved new showcase organization before mutation: ${organizationId}`)
  runConvex(options, 'showcaseDataset:begin', {
    datasetId: manifest.datasetId,
    datasetVersion: manifest.datasetVersion,
    product: manifest.product,
    organizationKey: options.organizationKey,
    organizationId,
    manifestHash: validation.manifestHash,
    assetManifestHash: validation.assetManifestHash,
    counts: EXPECTED_COUNTS,
    assetCount: validation.assetManifest.assets.length,
    ownerUserId: options['owner-user-id'],
  })
  const storageIds = await uploadAssets(options, validation, organizationId)
  for (let offset = 0; offset < validation.assetManifest.assets.length; offset += 10) {
    runConvex(options, 'showcaseDataset:applyAssets', {
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      organizationKey: options.organizationKey,
      organizationId,
      assets: validation.assetManifest.assets.slice(offset, offset + 10),
      storageIds: storageIds.slice(offset, offset + 10),
    })
  }
  const ids = { companies: [], projects: [], memberships: [], channels: [], messages: [], tasks: [], suggestions: [], attachments: [] }
  for (const recordType of RECORD_TYPE_ORDER) {
    if (recordType === 'organizations') continue
    const records = recordType === 'memberships'
      ? manifest.records.memberships.map((record) => ({
          ...record,
          companyKey: manifest.records.users.find((user) => user.externalKey === record.userKey)?.companyKey,
        }))
      : manifest.records[recordType]
    const batchSize = ['messages', 'memberships', 'tasks'].includes(recordType) ? 25 : 20
    for (let offset = 0; offset < records.length; offset += batchSize) {
      const result = runConvex(options, 'showcaseDataset:applyBatch', {
        datasetId: manifest.datasetId,
        datasetVersion: manifest.datasetVersion,
        organizationKey: options.organizationKey,
        organizationId,
        recordType,
        records: records.slice(offset, offset + batchSize),
      })
      if (ids[recordType]) ids[recordType].push(...(result.recordIds ?? []).map((entry) => entry.recordId))
    }
  }
  runConvex(options, 'showcaseDataset:finalize', {
    datasetId: manifest.datasetId,
    organizationKey: options.organizationKey,
    organizationId,
  })
  return { organizationId, ids }
}

async function main() {
  let options
  try {
    options = requireOptions(parseArgs(process.argv.slice(2)))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    return
  }
  const validation = validateTrackPack(options['asset-root'] ? { assetRoot: options['asset-root'] } : {})
  if (!validation.ok) {
    for (const error of validation.errors) console.error(`manifest: ${error}`)
    process.exitCode = 1
    return
  }
  if (options.mode === 'plan') {
    const report = {
      mode: 'plan',
      pack: options.pack,
      environment: options.environment,
      organizationKey: options.organizationKey,
      counts: EXPECTED_COUNTS,
      assetCount: validation.assetManifest.assets.length,
      manifestHash: validation.manifestHash,
      assetManifestHash: validation.assetManifestHash,
      targetedPacks: validation.manifest.targetedPacks,
    }
    if (options.json) console.log(JSON.stringify(report))
    else {
      printCounts(validation)
      console.log(JSON.stringify(report, null, 2))
    }
    return
  }
  if (options.mode === 'apply') {
    try {
      if (!options.json) printCounts(validation)
      const result = await applyPack(options, validation)
      const links = presenterLinks(options, validation.manifest, result.ids)
      const report = { mode: 'apply', ...result, counts: EXPECTED_COUNTS, assetCount: validation.assetManifest.assets.length, manifestHash: validation.manifestHash, assetManifestHash: validation.assetManifestHash, links }
      if (options.json) console.log(JSON.stringify(report))
      else {
        console.log(`Applied Track showcase-v1 to ${result.organizationId}`)
        for (const link of links) console.log(`  ${link.packKey}: ${link.entryLink}`)
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error), 1)
    }
    return
  }
  if (options.mode === 'verify') {
    try {
      const remote = runConvex(options, 'showcaseDataset:verify', {
        datasetId: validation.manifest.datasetId,
        organizationKey: options.organizationKey,
        organizationId: options['organization-id'],
        manifestHash: validation.manifestHash,
        assetManifestHash: validation.assetManifestHash,
        assetCount: validation.assetManifest.assets.length,
      })
      const report = { mode: 'verify', ...remote, expectedCounts: EXPECTED_COUNTS, manifestHash: validation.manifestHash, assetManifestHash: validation.assetManifestHash }
      if (options.json) console.log(JSON.stringify(report))
      else {
        printCounts(validation)
        console.log(JSON.stringify(remote, null, 2))
      }
      if (!remote.ok) process.exitCode = 1
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error), 1)
    }
    return
  }
  try {
    const resolved = runConvex(options, 'showcaseDataset:resolveOrganization', {
      datasetId: validation.manifest.datasetId,
      product: validation.manifest.product,
      organizationKey: options.organizationKey,
      companyHandles: companyHandles(validation.manifest),
    })
    if (resolved.status !== 'owned' || resolved.organizationId !== options['confirm-organization']) throw new Error('removal confirmation does not match the exact resolved showcase organization')
    runConvex(options, 'showcaseDataset:beginRemove', {
      datasetId: validation.manifest.datasetId,
      organizationKey: options.organizationKey,
      organizationId: resolved.organizationId,
      confirmOrganizationId: options['confirm-organization'],
    })
    const removalOrder = ['attachments', 'suggestions', 'tasks', 'messages', 'channels', 'generalChannels', 'memberships', 'taskWorkflowStates', 'taskBoards', 'projectCompanies', 'projects', 'companyMembers', 'companies', 'users', 'showcaseDatasetAssets', 'organization']
    for (const recordType of removalOrder) {
      while (true) {
        const result = runConvex(options, 'showcaseDataset:removeBatch', {
          datasetId: validation.manifest.datasetId,
          organizationKey: options.organizationKey,
          organizationId: resolved.organizationId,
          confirmOrganizationId: options['confirm-organization'],
          recordType,
          limit: 25,
        })
        if (result.remaining === 0) break
      }
    }
    const result = runConvex(options, 'showcaseDataset:finishRemove', {
      datasetId: validation.manifest.datasetId,
      organizationKey: options.organizationKey,
      organizationId: resolved.organizationId,
      confirmOrganizationId: options['confirm-organization'],
    })
    if (options.json) console.log(JSON.stringify({ mode: 'remove', ...result }))
    else console.log(`Removed only Track showcase-v1 records owned by ${resolved.organizationId}.`)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 1)
  }
}

await main()
