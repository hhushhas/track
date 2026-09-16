import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const credentialsPath = resolve(root, '.credentials/track-role-demo.json')
const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.VITE_CONVEX_SITE_URL
if (!siteUrl) throw new Error('Set CONVEX_SITE_URL or VITE_CONVEX_SITE_URL before running the role demo seed.')
const deployment = process.env.CONVEX_DEPLOYMENT
if (!deployment?.startsWith('dev:')) {
  throw new Error('The role demo seed only runs against an explicit CONVEX_DEPLOYMENT=dev:<deployment> target.')
}
const deploymentName = deployment.slice('dev:'.length)
const parsedSiteUrl = new URL(siteUrl)
const localSite = parsedSiteUrl.hostname === 'localhost' || parsedSiteUrl.hostname === '127.0.0.1'
if (!localSite && parsedSiteUrl.hostname !== `${deploymentName}.convex.site`) {
  throw new Error('CONVEX_SITE_URL does not match the selected development Convex deployment.')
}

const users = [
  ['olivia-owner', 'olivia.owner@track.local', 'Olivia Carter'],
  ['daniel-admin', 'daniel.admin@track.local', 'Daniel Brooks'],
  ['maya-member', 'maya.member@track.local', 'Maya Patel'],
  ['ethan-project-owner', 'ethan.project-owner@track.local', 'Ethan Wilson'],
  ['sophia-project-member', 'sophia.project-member@track.local', 'Sophia Khan'],
  ['noah-channel-manager', 'noah.channel-manager@track.local', 'Noah Adams'],
  ['emma-channel-member', 'emma.channel-member@track.local', 'Emma Rodriguez'],
]

mkdirSync(dirname(credentialsPath), { recursive: true })
let saved = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : null
if (!saved || saved.length !== users.length) {
  saved = users.map(([key, email, name]) => ({ key, email, name, password: `TrackDemo!${randomBytes(9).toString('base64url')}` }))
  writeFileSync(credentialsPath, JSON.stringify(saved, null, 2), { encoding: 'utf8', mode: 0o600 })
}

for (const user of saved) {
  const response = await fetch(`${siteUrl.replace(/\/$/, '')}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: process.env.DEMO_WEB_ORIGIN ?? 'http://localhost:3000' },
    body: JSON.stringify({ email: user.email, password: user.password, name: user.name }),
  })
  if (!response.ok) {
    const body = await response.text()
    if (!body.toLowerCase().includes('already') && !body.toLowerCase().includes('exist')) {
      throw new Error(`Could not create ${user.email}: ${response.status} ${body}`)
    }
  }
}

for (const user of saved) {
  const response = await fetch(`${siteUrl.replace(/\/$/, '')}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: process.env.DEMO_WEB_ORIGIN ?? 'http://localhost:3000' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  if (!response.ok) {
    throw new Error(`Could not verify sign-in for ${user.email}: ${response.status} ${await response.text()}`)
  }
}

if (process.env.DEMO_SKIP_PUSH !== '1') {
  const result = spawnSync('pnpm', ['exec', 'convex', 'run', 'roleDemoSeed:seed', '{}', '--push'], { cwd: root, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(`Credentials saved to ${credentialsPath}`)
console.log(`Verified ${saved.length} role-demo accounts without printing passwords.`)
