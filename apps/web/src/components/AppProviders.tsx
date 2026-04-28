import { ConvexProvider } from 'convex/react'
import type { ReactNode } from 'react'

import { TooltipProvider } from '#/components/ui/tooltip'
import { convexClient } from '../lib/convex-client'

export default function AppProviders({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ConvexProvider client={convexClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexProvider>
  )
}
