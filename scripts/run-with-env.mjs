import { spawnSync } from 'node:child_process'

const argumentsList = process.argv.slice(2)
const separatorIndex = argumentsList.indexOf('--')

if (separatorIndex < 1 || separatorIndex === argumentsList.length - 1) {
  throw new Error('Usage: run-with-env.mjs NAME=value [NAME=value ...] -- command [args ...]')
}

const environment = { ...process.env }
for (const assignment of argumentsList.slice(0, separatorIndex)) {
  const equalsIndex = assignment.indexOf('=')
  if (equalsIndex < 1) throw new Error(`Invalid environment assignment: ${assignment}`)
  environment[assignment.slice(0, equalsIndex)] = assignment.slice(equalsIndex + 1)
}

const [command, ...commandArguments] = argumentsList.slice(separatorIndex + 1)
const result = spawnSync(command, commandArguments, {
  env: environment,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
