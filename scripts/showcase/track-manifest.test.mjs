import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { EXPECTED_COUNTS, loadTrackPack, validateTrackPack } from './track-manifest.mjs'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const assetRoot = fileURLToPath(new URL('../../showcase-data/showcase-v1', import.meta.url))
const scriptPath = fileURLToPath(new URL('../seed-dataset.mjs', import.meta.url))

test('Track showcase-v1 validates its frozen manifest and assets', () => {
  const validation = validateTrackPack({ assetRoot })
  assert.equal(validation.ok, true, validation.errors.join('\n'))
  assert.deepEqual(Object.fromEntries(Object.entries(validation.manifest.records).map(([key, value]) => [key, value.length])), EXPECTED_COUNTS)
  assert.equal(validation.assetManifest.assets.length, 61)
  assert.equal(validation.checkedAssets.length, 61)
  assert.equal(validation.manifestHash, 'sha256:57533c0fc038a0ef188dac037710143ff7d9f0964bc621752001a33b199bd0a9')
  assert.equal(validation.assetManifestHash, 'sha256:007e2402c550d61cdee49e0555b16a25f2f8094bdc01a3883272ebcee8479fdc')
  const rejectedAtlasSuggestion = validation.manifest.records.suggestions.find((suggestion) => suggestion.externalKey === 'track-suggestion-03')
  assert.match(rejectedAtlasSuggestion?.explanation ?? '', /an Atlas Mobile Release task/)
  assert.doesNotMatch(rejectedAtlasSuggestion?.explanation ?? '', /a Atlas Mobile Release task/)
  const dispositionCounts = validation.manifest.records.suggestions.reduce((counts, suggestion) => ({
    ...counts,
    [suggestion.disposition]: (counts[suggestion.disposition] ?? 0) + 1,
  }), {})
  assert.deepEqual(dispositionCounts, { accepted: 10, corrected: 10, pending: 5, rejected: 5 })
})

test('Track plan is deterministic and validates organization isolation', () => {
  const runPlan = (organizationKey) => spawnSync(process.execPath, [scriptPath, 'plan', '--pack', 'showcase-v1', '--environment', 'hosted-dev', '--organization-key', organizationKey, '--json'], { cwd: repositoryRoot, encoding: 'utf8' })
  const first = runPlan('showcase-track-one-2026')
  const retry = runPlan('showcase-track-one-2026')
  const second = runPlan('showcase-track-two-2026')
  assert.equal(first.status, 0)
  assert.equal(retry.status, 0)
  assert.equal(second.status, 0)
  assert.deepEqual(JSON.parse(first.stdout), JSON.parse(retry.stdout))
  assert.notEqual(JSON.parse(first.stdout).organizationKey, JSON.parse(second.stdout).organizationKey)
})

test('mutation modes fail closed before contacting Convex', () => {
  const missingAssetRoot = spawnSync(process.execPath, [scriptPath, 'apply', '--pack', 'showcase-v1', '--environment', 'hosted-dev', '--organization-key', 'showcase-track-preflight-2026', '--repair-existing'], { cwd: repositoryRoot, encoding: 'utf8' })
  assert.equal(missingAssetRoot.status, 2)
  assert.match(missingAssetRoot.stderr, /--asset-root/)
  assert.doesNotMatch(missingAssetRoot.stderr, /Convex did not|Resolved new showcase organization/)

  const productionConfirmation = spawnSync(process.execPath, [scriptPath, 'apply', '--pack', 'showcase-v1', '--environment', 'production', '--organization-key', 'showcase-track-preflight-2026', '--repair-existing', '--asset-root', assetRoot], { cwd: repositoryRoot, encoding: 'utf8' })
  assert.equal(productionConfirmation.status, 2)
  assert.match(productionConfirmation.stderr, /confirm-production/)
})

test('local planning stays offline', () => {
  const result = spawnSync(process.execPath, [scriptPath, 'plan', '--pack', 'showcase-v1', '--environment', 'local', '--organization-key', 'showcase-track-plan-2026', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, CONVEX_DEPLOYMENT: undefined },
  })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.equal(report.deployment, null)
})

test('remove requires an exact organization confirmation', () => {
  const result = spawnSync(process.execPath, [scriptPath, 'remove', '--pack', 'showcase-v1', '--environment', 'hosted-dev', '--organization-key', 'showcase-track-remove-2026'], { cwd: repositoryRoot, encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /confirm-organization/)
})

test('vendored keys and native references are complete', () => {
  const { manifest } = loadTrackPack()
  const messages = new Set(manifest.records.messages.map((record) => record.externalKey))
  const projects = new Set(manifest.records.projects.map((record) => record.externalKey))
  for (const task of manifest.records.tasks) {
    assert.equal(projects.has(task.projectKey), true)
    assert.equal(messages.has(task.sourceMessageKey), true)
  }
  for (const suggestion of manifest.records.suggestions) {
    assert.equal(projects.has(suggestion.projectKey), true)
    assert.equal(suggestion.sourceMessageKeys.length, 2)
    assert.ok(suggestion.sourceMessageKeys.every((key) => messages.has(key)))
  }
})
