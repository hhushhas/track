import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('scheduled incremental AI review', { minutes: 5 }, internal.ai.runScheduledReviews, {})

export default crons
