import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  WEB_DEPLOYMENT_TARGETS,
  assertWebBuild,
  deploymentEnvironment,
  getDeploymentTarget,
  parseDeploymentArguments,
  validateDeploymentTargets,
  workerVariables,
} from './deploy-web.mjs'

test('web deployment targets are distinct and internally consistent', () => {
  validateDeploymentTargets(WEB_DEPLOYMENT_TARGETS)
  assert.equal(getDeploymentTarget('production').worker, 'track')
  assert.equal(getDeploymentTarget('hosted-dev').worker, 'track-web')
  assert.notEqual(getDeploymentTarget('production').convexUrl, getDeploymentTarget('hosted-dev').convexUrl)
  assert.throws(() => validateDeploymentTargets({
    production: WEB_DEPLOYMENT_TARGETS.production,
    'hosted-dev': { ...WEB_DEPLOYMENT_TARGETS['hosted-dev'], convexUrl: WEB_DEPLOYMENT_TARGETS.production.convexUrl, convexSiteUrl: WEB_DEPLOYMENT_TARGETS.production.convexSiteUrl },
  }), /share Convex deployment/)
})

test('deployment environment overrides every web Convex alias', () => {
  const target = getDeploymentTarget('production')
  const environment = deploymentEnvironment(target, { VITE_CONVEX_URL: 'wrong', VITE_CONVEX_URL_PROD: 'wrong' })
  assert.equal(environment.VITE_CONVEX_URL, target.convexUrl)
  assert.equal(environment.VITE_CONVEX_URL_PROD, target.convexUrl)
  assert.equal(environment.VITE_CONVEX_SITE_URL, target.convexSiteUrl)
  assert.equal(environment.VITE_CONVEX_SITE_URL_PROD, target.convexSiteUrl)
})

test('worker variables keep runtime aliases on the selected Convex deployment', () => {
  const target = getDeploymentTarget('hosted-dev')
  assert.deepEqual(workerVariables(target), [
    ['CONVEX_URL', target.convexUrl],
    ['CONVEX_SITE_URL', target.convexSiteUrl],
    ['VITE_CONVEX_URL', target.convexUrl],
    ['VITE_CONVEX_URL_PROD', target.convexUrl],
    ['VITE_CONVEX_SITE_URL', target.convexSiteUrl],
    ['VITE_CONVEX_SITE_URL_PROD', target.convexSiteUrl],
  ])
})

test('bundle guard accepts only the selected Convex target without the bootstrap throw', () => {
  const target = getDeploymentTarget('production')
  const root = mkdtempSync(join(tmpdir(), 'track-web-deploy-'))
  try {
    mkdirSync(join(root, 'public/assets'), { recursive: true })
    writeFileSync(join(root, 'public/assets/index.js'), `new ConvexReactClient(${JSON.stringify(target.convexUrl)})`)
    assert.equal(assertWebBuild({ target, buildRoot: root }).targetFiles.length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('bundle guard rejects a missing target, a wrong target, and the bootstrap throw', () => {
  const target = getDeploymentTarget('hosted-dev')
  const root = mkdtempSync(join(tmpdir(), 'track-web-deploy-'))
  try {
    mkdirSync(join(root, 'public/assets'), { recursive: true })
    const asset = join(root, 'public/assets/index.js')
    writeFileSync(asset, 'throw new Error("VITE_CONVEX_URL_PROD is required")')
    assert.throws(() => assertWebBuild({ target, buildRoot: root }), /does not contain/)
    writeFileSync(asset, 'new ConvexReactClient("https://fleet-manatee-941.convex.cloud")')
    assert.throws(() => assertWebBuild({ target, buildRoot: root }), /does not contain|wrong Convex target/)
    writeFileSync(asset, `new ConvexReactClient(${JSON.stringify(target.convexUrl)}); throw new Error("VITE_CONVEX_URL_PROD is required")`)
    assert.throws(() => assertWebBuild({ target, buildRoot: root }), /missing-target bootstrap path/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('deployment CLI requires exactly one supported target', () => {
  assert.deepEqual(parseDeploymentArguments(['production']), { help: false, dryRun: false, targetName: 'production' })
  assert.deepEqual(parseDeploymentArguments(['hosted-dev', '--dry-run']), { help: false, dryRun: true, targetName: 'hosted-dev' })
  assert.deepEqual(parseDeploymentArguments(['--help']), { help: true, dryRun: false, targetName: undefined })
  assert.throws(() => parseDeploymentArguments([]), /usage:/)
  assert.throws(() => parseDeploymentArguments(['production', 'hosted-dev']), /usage:/)
})
