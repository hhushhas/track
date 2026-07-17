import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('memory run view cleanup', { hours: 12 }, (internal as any).memoryActions.cleanupRunViews, {})
crons.interval(
  'push receipt reconciliation',
  { minutes: 5 },
  internal.pushNotifications.reconcileDeliveryReceipts,
  {},
)
crons.interval(
  'push interrupted delivery recovery',
  { minutes: 1 },
  internal.pushDelivery.recoverStaleSendingIntents,
  {},
)

export default crons
