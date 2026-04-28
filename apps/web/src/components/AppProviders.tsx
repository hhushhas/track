import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ReactNode } from 'react'

import { TooltipProvider } from '#/components/ui/tooltip'
import { authClient } from '#/lib/auth-client'
import { convexClient } from '../lib/convex-client'

export default function AppProviders({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convexClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexBetterAuthProvider>
  )
}
