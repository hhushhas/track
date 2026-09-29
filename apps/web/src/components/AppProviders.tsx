import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import { TooltipProvider } from '#/components/ui/tooltip'
import { authClient } from '#/lib/auth-client'
import { setDiagnosticAuthenticated } from '../lib/browser-diagnostics'
import { convexClient } from '../lib/convex-client'

type ProviderAuthClient = ComponentProps<typeof ConvexBetterAuthProvider>['authClient']
const providerAuthClient = authClient as unknown as ProviderAuthClient

function DiagnosticAuthSync() {
  const { isAuthenticated } = useConvexAuth()
  useEffect(() => {
    setDiagnosticAuthenticated(isAuthenticated)
    return () => setDiagnosticAuthenticated(false)
  }, [isAuthenticated])
  return null
}

export default function AppProviders({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ConvexBetterAuthProvider authClient={providerAuthClient} client={convexClient}>
      <DiagnosticAuthSync />
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexBetterAuthProvider>
  )
}
