import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import {
  backfillTaskArchiveSearchFieldsBatch,
  backfillTaskExitSnapshotSearchFieldsBatch,
} from './lib/taskLifecycle'

/**
 * Backfills one materialized entitlement and schedules the next cursor page.
 * This is intentionally internal: run it as a deployment migration, never as
 * a user-facing mutation.
 */
export const backfillArchiveSearchFields = internalMutation({
  args: {
    entitlementId: v.id('projectArchiveEntitlements'),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await backfillTaskArchiveSearchFieldsBatch(ctx, args)
    if (!result.done && result.cursor) {
      await ctx.scheduler.runAfter(0, internal.taskArchiveMaintenance.backfillArchiveSearchFields, {
        entitlementId: args.entitlementId,
        cursor: result.cursor,
      })
    }
    return result
  },
})

/**
 * Backfills one operation staging scope and schedules the next cursor page.
 * This is intentionally internal: run it as a deployment migration, never as
 * a user-facing mutation.
 */
export const backfillExitSnapshotSearchFields = internalMutation({
  args: {
    projectCompanyId: v.id('projectCompanies'),
    operationId: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await backfillTaskExitSnapshotSearchFieldsBatch(ctx, args)
    if (!result.done && result.cursor) {
      await ctx.scheduler.runAfter(0, internal.taskArchiveMaintenance.backfillExitSnapshotSearchFields, {
        projectCompanyId: args.projectCompanyId,
        operationId: args.operationId,
        cursor: result.cursor,
      })
    }
    return result
  },
})
