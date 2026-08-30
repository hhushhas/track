import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const webRoot = join(repositoryRoot, 'apps/web')
const outputRoot = join(webRoot, '.output')
const productionBootstrapError = 'VITE_CONVEX_URL_PROD is required'
const convexCloudUrlPattern = /^https:\/\/([a-z0-9-]+)\.convex\.cloud$/
const convexSiteUrlPattern = /^https:\/\/([a-z0-9-]+)\.convex\.site$/

export const WEB_DEPLOYMENT_TARGETS = Object.freeze({
  production: Object.freeze({
    worker: 'track',
    convexUrl: 'https://fleet-manatee-941.convex.cloud',
    convexSiteUrl: 'https://fleet-manatee-941.convex.site',
  }),
  'hosted-dev': Object.freeze({
    worker: 'track-web',
    convexUrl: 'https://enduring-impala-781.convex.cloud',
    convexSiteUrl: 'https://enduring-impala-781.convex.site',
  }),
})

export function validateDeploymentTargets(targets) {
  const expectedTargetNames = ['production', 'hosted-dev']
  const targetNames = Object.keys(targets)
  if (targetNames.length !== expectedTargetNames.length || expectedTargetNames.some((name) => !targetNames.includes(name))) {
    throw new Error('web deployment targets must define production and hosted-dev exactly once')
  }

  const workers = new Set()
  const deployments = new Set()
  for (const [name, target] of Object.entries(targets)) {
    if (!target || typeof target.worker !== 'string' || typeof target.convexUrl !== 'string' || typeof target.convexSiteUrl !== 'string') {
      throw new Error(`web deployment target ${name} is incomplete`)
    }
    if (workers.has(target.worker)) throw new Error(`web deployment targets share worker ${target.worker}`)
    workers.add(target.worker)
    if (deployments.has(target.convexUrl)) throw new Error(`web deployment targets share Convex deployment ${target.convexUrl}`)
    deployments.add(target.convexUrl)

    const convexUrl = convexCloudUrlPattern.exec(target.convexUrl)
    const convexSiteUrl = convexSiteUrlPattern.exec(target.convexSiteUrl)
    if (!convexUrl || !convexSiteUrl || convexUrl[1] !== convexSiteUrl[1]) {
      throw new Error(`web deployment target ${name} has mismatched Convex URLs`)
    }
  }
  return targets
}

validateDeploymentTargets(WEB_DEPLOYMENT_TARGETS)

export function getDeploymentTarget(name) {
  const target = WEB_DEPLOYMENT_TARGETS[name]
  if (!target) throw new Error(`unknown web deployment target ${name}; use production or hosted-dev`)
  return target
}

export function deploymentEnvironment(target, environment = process.env) {
  return {
    ...environment,
    TRACK_WEB_DEPLOY_TARGET: target.worker,
    VITE_CONVEX_URL: target.convexUrl,
    VITE_CONVEX_URL_PROD: target.convexUrl,
    VITE_CONVEX_SITE_URL: target.convexSiteUrl,
    VITE_CONVEX_SITE_URL_PROD: target.convexSiteUrl,
  }
}

function collectJavaScriptFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(path))
    else if (entry.isFile() && /\.m?js$/.test(entry.name)) files.push(path)
  }
  return files
}

export function assertWebBuild({ target, buildRoot = outputRoot }) {
  const publicFiles = collectJavaScriptFiles(join(buildRoot, 'public'))
  if (publicFiles.length === 0) throw new Error(`web build has no JavaScript assets under ${relative(repositoryRoot, join(buildRoot, 'public'))}`)

  const allFiles = collectJavaScriptFiles(buildRoot)
  const contents = allFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') }))
  const publicTargetFiles = contents.filter(({ path, text }) => publicFiles.includes(path) && text.includes(target.convexUrl))
  if (publicTargetFiles.length === 0) throw new Error(`web production bundle does not contain ${target.convexUrl}`)

  const otherConfiguredTargets = Object.values(WEB_DEPLOYMENT_TARGETS)
    .filter((configuredTarget) => configuredTarget.convexUrl !== target.convexUrl)
    .map((configuredTarget) => configuredTarget.convexUrl)
    .filter((url) => contents.some(({ text }) => text.includes(url)))
  if (otherConfiguredTargets.length > 0) throw new Error(`web production bundle contains the wrong Convex target: ${otherConfiguredTargets.join(', ')}`)
  if (contents.some(({ text }) => text.includes(productionBootstrapError))) {
    throw new Error(`web production bundle still contains the missing-target bootstrap path: ${productionBootstrapError}`)
  }

  return { files: allFiles, targetFiles: publicTargetFiles.map(({ path }) => path) }
}

export function workerVariables(target) {
  return [
    ['CONVEX_URL', target.convexUrl],
    ['CONVEX_SITE_URL', target.convexSiteUrl],
    ['VITE_CONVEX_URL', target.convexUrl],
    ['VITE_CONVEX_URL_PROD', target.convexUrl],
    ['VITE_CONVEX_SITE_URL', target.convexSiteUrl],
    ['VITE_CONVEX_SITE_URL_PROD', target.convexSiteUrl],
  ]
}

function packageManagerCommand() {
  if (process.env.npm_execpath) return { command: process.execPath, prefix: [process.env.npm_execpath] }
  return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', prefix: [] }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} failed${result.signal ? ` with ${result.signal}` : ` with exit code ${result.status}`}`)
}

function gitRevision() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`could not determine the committed revision: ${result.error?.message ?? result.stderr.trim()}`)
  return result.stdout.trim()
}

function buildWeb(target) {
  const packageManager = packageManagerCommand()
  run(packageManager.command, [...packageManager.prefix, '--filter', '@track/web', 'build', '--', '--mode', 'production'], {
    cwd: repositoryRoot,
    env: deploymentEnvironment(target),
  })
  return assertWebBuild({ target })
}

function deployWeb(target, { dryRun }) {
  const packageManager = packageManagerCommand()
  const wranglerConfig = join(outputRoot, 'server/wrangler.json')
  const args = [
    ...packageManager.prefix,
    'exec',
    'wrangler',
    'deploy',
    '--config',
    wranglerConfig,
    '--name',
    target.worker,
    '--no-bundle',
    '--keep-vars',
    '--message',
    `${target.worker}-${gitRevision()}`,
  ]
  for (const [name, value] of workerVariables(target)) args.push('--var', `${name}=${value}`)
  if (dryRun) args.push('--dry-run')
  run(packageManager.command, args, { cwd: repositoryRoot })
}

export function parseDeploymentArguments(argumentsList) {
  const { values, positionals } = parseArgs({
    args: argumentsList,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) return { help: true, dryRun: false, targetName: undefined }
  if (positionals.length !== 1) throw new Error('usage: pnpm deploy:web <production|hosted-dev> [--dry-run]')
  return { help: false, dryRun: values['dry-run'] === true, targetName: positionals[0] }
}

export function formatHelp() {
  return 'usage: pnpm deploy:web <production|hosted-dev> [--dry-run]'
}

export function isMainModule() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
}

if (isMainModule()) {
  try {
    const options = parseDeploymentArguments(process.argv.slice(2))
    if (options.help) {
      console.log(formatHelp())
    } else {
      const target = getDeploymentTarget(options.targetName)
      console.log(`Building ${target.worker} for ${target.convexUrl}`)
      const build = buildWeb(target)
      console.log(`Bundle guard passed with ${build.targetFiles.length} client target asset(s)`)
      deployWeb(target, options)
    }
  } catch (error) {
    console.error(`web deployment failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
