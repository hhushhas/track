import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ReactNode } from 'react'

import { authClient } from '../lib/auth-client'
import { convexClient } from '../lib/convex-client'

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convexClient}>
      {children}
    </ConvexBetterAuthProvider>
  )
}
