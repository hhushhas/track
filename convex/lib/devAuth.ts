import { devAuthBypassUser as sharedDevAuthBypassUser } from '@track/shared'

export const devAuthBypassUser = {
  ...sharedDevAuthBypassUser,
  profileDesignation: 'Developer',
  profileBannerStyle: 'silk',
  timezone: 'UTC',
} as const

type DevAuthEnvironment = Readonly<{
  BETTER_AUTH_URL?: string
  DEV_AUTH_BYPASS?: string
  SITE_URL?: string
}>

export function isDevAuthBypassEnabled(
  environment: DevAuthEnvironment = {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
    SITE_URL: process.env.SITE_URL,
  },
) {
  if (environment.DEV_AUTH_BYPASS !== '1') return false

  const siteUrl = environment.SITE_URL ?? environment.BETTER_AUTH_URL
  if (!siteUrl) return false

  try {
    const url = new URL(siteUrl)
    return url.protocol === 'http:' && (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    )
  } catch {
    return false
  }
}
