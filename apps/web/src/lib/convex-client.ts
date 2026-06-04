import { ConvexReactClient } from 'convex/react'

const runtimeEnv = typeof process === 'undefined' ? undefined : process.env
const convexUrl = import.meta.env.PROD
  ? (import.meta.env.VITE_CONVEX_URL_PROD ??
    import.meta.env.VITE_CONVEX_URL ??
    runtimeEnv?.VITE_CONVEX_URL_PROD ??
    runtimeEnv?.VITE_CONVEX_URL)
  : (import.meta.env.VITE_CONVEX_URL ?? runtimeEnv?.VITE_CONVEX_URL)

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is required')
}

export const convexClient = new ConvexReactClient(convexUrl)
