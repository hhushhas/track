import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

const runtimeEnv = typeof process === 'undefined' ? undefined : process.env
const authBaseUrl = import.meta.env.PROD
  ? (import.meta.env.VITE_CONVEX_SITE_URL_PROD
      ?? import.meta.env.VITE_CONVEX_SITE_URL
      ?? runtimeEnv?.VITE_CONVEX_SITE_URL_PROD
      ?? runtimeEnv?.VITE_CONVEX_SITE_URL
      ?? runtimeEnv?.CONVEX_SITE_URL_PROD
      ?? runtimeEnv?.CONVEX_SITE_URL)
  : (import.meta.env.VITE_CONVEX_SITE_URL ?? runtimeEnv?.VITE_CONVEX_SITE_URL ?? runtimeEnv?.CONVEX_SITE_URL)

if (!authBaseUrl) {
  throw new Error(
    import.meta.env.PROD
      ? 'VITE_CONVEX_SITE_URL_PROD is required'
      : 'VITE_CONVEX_SITE_URL is required',
  )
}

const browserAuthStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  },
}

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    crossDomainClient({ storage: browserAuthStorage }),
    convexClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/two-factor'
      },
    }),
  ],
})
