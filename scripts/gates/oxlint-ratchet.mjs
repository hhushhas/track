import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const baselinePath = resolve(repoRoot, '.oxlint-known-violations.json')

function findingKey(finding) {
  const location = finding.labels[0]?.span
  if (!location) throw new Error(`Lint diagnostic has no source location: ${finding.message}`)
  const lines = readFileSync(resolve(repoRoot, finding.filename), 'utf8').split(/\r?\n/)
  const sourceLine = lines[location.line - 1]
  if (sourceLine === undefined) throw new Error(`Invalid lint location: ${finding.filename}:${location.line}`)
  const fingerprint = createHash('sha256').update(sourceLine.replace(/\s+/g, ' ').trim()).digest('hex')
  return [finding.code, fingerprint].join('|')
}

try {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.findings)) {
    throw new Error(`Invalid lint baseline: ${baselinePath}`)
  }
  const allowances = new Map()
  for (const finding of baseline.findings) {
    const key = [finding.code, finding.fingerprint].join('|')
    allowances.set(key, (allowances.get(key) ?? 0) + 1)
  }

  // Type-aware rules require a TypeScript project; repository scripts and
  // public worker JavaScript are outside these four checked source roots.
  const result = spawnSync('pnpm', [
    'exec', 'oxlint', '--config', 'q9-oxlint.json', '--type-aware', '--threads', '1', '--format', 'json',
    'apps/web/src', 'apps/mobile/src', 'packages/shared/src', 'convex',
  ], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Oxlint exited ${result.status}: ${result.stderr.trim()}`)
  }
  const report = JSON.parse(result.stdout)
  if (!Array.isArray(report.diagnostics)) throw new Error('Oxlint did not return diagnostics')
  const errors = report.diagnostics.filter((finding) => finding.severity === 'error')
  const newFindings = errors.filter((finding) => {
    const key = findingKey(finding)
    const remaining = allowances.get(key) ?? 0
    if (remaining === 0) return true
    allowances.set(key, remaining - 1)
    return false
  })
  if (newFindings.length) {
    console.error(`Canonical type-aware lint found ${newFindings.length} new error(s):`)
    for (const finding of newFindings) {
      const location = finding.labels[0].span
      console.error(`  ${finding.filename}:${location.line}:${location.column} ${finding.code}: ${finding.message}`)
    }
    process.exitCode = 1
  } else {
    console.log(`Canonical type-aware lint ratchet passed (${errors.length} existing error(s)).`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
