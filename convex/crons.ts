import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('memory run view cleanup', { hours: 12 }, (internal as any).memoryActions.cleanupRunViews, {})

export default crons
