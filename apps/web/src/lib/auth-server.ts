import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

const convexUrl = process.env.VITE_CONVEX_URL_PROD ?? process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL
const convexSiteUrl =
  process.env.VITE_CONVEX_SITE_URL_PROD ?? process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL

if (!convexUrl || !convexSiteUrl) {
  throw new Error('VITE_CONVEX_URL and VITE_CONVEX_SITE_URL are required')
}

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
})
