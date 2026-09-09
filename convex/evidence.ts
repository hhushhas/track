import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'

import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { taskView } from './lib/taskData'
import { resolveTaskRequestContext } from './lib/taskPolicy'

const identityArgs = {
  actingCompanyId: v.optional(v.id('companies')),
  projectMemberId: v.optional(v.id('projectMembers')),
}

type EvidenceTaskView = Awaited<ReturnType<typeof taskView>>
type EvidenceSnapshots = {
  channelSnapshots?: Array<Pick<Doc<'groups'>, '_id' | 'name' | 'status'>>
  threadSnapshots?: Array<Pick<Doc<'channelThreads'>, '_id' | 'name' | 'status'>>
  memberSnapshots?: Array<Pick<Doc<'projectMembers'>, '_id' | 'userDisplayNameSnapshot'>>
}

async function evidenceItems(ctx: QueryCtx, views: EvidenceTaskView[], snapshots?: EvidenceSnapshots) {
  const items = []
  for (const view of views) {
    for (const reference of view.references) {
      const [group, thread, creator] = snapshots
        ? [
            snapshots.channelSnapshots?.find((item) => String(item._id) === String(reference.groupId)) ?? null,
            snapshots.threadSnapshots?.find((item) => String(item._id) === String(reference.channelThreadId)) ?? null,
            snapshots.memberSnapshots?.find((item) => String(item._id) === String(reference.actorProjectMemberId)) ?? null,
          ]
        : await Promise.all([
            reference.groupId ? ctx.db.get(reference.groupId) : null,
            reference.channelThreadId ? ctx.db.get(reference.channelThreadId) : null,
            ctx.db.get(reference.actorProjectMemberId),
          ])
      items.push({
        reference,
        task: view.task,
        group: group?._id && group.name ? { _id: group._id, name: group.name, status: group.status } : null,
        thread: thread?._id && thread.name ? { _id: thread._id, name: thread.name, status: thread.status } : null,
        creator: creator ? {
          _id: creator._id,
          displayName: creator.userDisplayNameSnapshot ?? 'Project member',
        } : null,
      })
    }
  }
  return items.sort((left, right) => right.reference.createdAt - left.reference.createdAt)
}

export const listProjectPage = query({
  args: { projectId: v.id('projects'), paginationOpts: paginationOptsValidator, ...identityArgs },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const access = await resolveTaskRequestContext(ctx, actor, args.projectId, args)
    if (access.capabilities.accessMode === 'archive' && access.entitlement) {
      const result = await ctx.db.query('taskArchiveSnapshots')
        .withIndex('by_entitlement_table', (q) =>
          q.eq('entitlementId', access.entitlement!._id).eq('sourceTable', 'taskReferences'),
        )
        .order('desc')
        .paginate(args.paginationOpts)
      const page = []
      for (const referenceSnapshot of result.page) {
        const reference = referenceSnapshot.payload as Doc<'taskReferences'>
        if (reference.groupId && !access.entitlement.channelIds.includes(reference.groupId)) continue
        const taskSnapshot = await ctx.db.query('taskArchiveSnapshots')
          .withIndex('by_entitlement_source', (q) =>
            q.eq('entitlementId', access.entitlement!._id)
              .eq('sourceTable', 'tasks')
              .eq('sourceId', String(reference.taskId)),
          )
          .unique()
        if (!taskSnapshot) continue
        const [item] = await evidenceItems(ctx, [{
          task: taskSnapshot.payload as Doc<'tasks'>,
          references: [reference],
        } as EvidenceTaskView], access.entitlement)
        if (item) page.push(item)
      }
      return { ...result, page }
    }
    const channelMemberships = access.actingCompanyId
      ? await ctx.db.query('groupMembers')
          .withIndex('by_project_member_status', (q) =>
            q.eq('projectMemberId', access.projectMember._id).eq('status', 'active'),
          )
          .take(1_001)
      : (await ctx.db.query('groupMembers')
          .withIndex('by_user', (q) => q.eq('userId', actor.userId))
          .take(1_001))
          .filter((membership) =>
            membership.projectId === args.projectId &&
            (!membership.status || membership.status === 'active'),
          )
    if (channelMemberships.length > 1_000) throw new Error('evidence_channel_limit_exceeded')
    const groupIds = [...new Set(channelMemberships.map((membership) => membership.groupId))]
    const indexedReferences = ctx.db.query('taskReferences')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId))
    const visibleReferences = groupIds.length
      ? indexedReferences.filter((q) => q.or(
          q.eq(q.field('groupId'), undefined),
          ...groupIds.map((groupId) => q.eq(q.field('groupId'), groupId)),
        ))
      : indexedReferences.filter((q) => q.eq(q.field('groupId'), undefined))
    const result = await visibleReferences
      .order('desc')
      .paginate(args.paginationOpts)
    const page = []
    for (const persistedReference of result.page) {
      const task = await ctx.db.get(persistedReference.taskId)
      if (!task || task.projectId !== args.projectId || task.archivedAt) continue
      const scopedGroupIds = [...new Set(
        [persistedReference.groupId, task.groupId].filter(
          (groupId): groupId is NonNullable<typeof groupId> => groupId !== undefined,
        ),
      )]
      let canReadEveryScope = true
      for (const scopedGroupId of scopedGroupIds) {
        try {
          const channelAccess = await resolveTaskRequestContext(ctx, actor, task.projectId, args, scopedGroupId)
          if (!channelAccess.capabilities.canReadChannel) {
            canReadEveryScope = false
            break
          }
        } catch {
          canReadEveryScope = false
          break
        }
      }
      if (!canReadEveryScope) continue
      if (scopedGroupIds.length === 0 && !access.capabilities.canReadProject) {
        continue
      }
      const view = await taskView(
        ctx,
        task,
        new Set(scopedGroupIds.map(String)),
      )
      const reference = view.references.find((candidate) => candidate._id === persistedReference._id)
      if (!reference) continue
      const [item] = await evidenceItems(ctx, [{ ...view, references: [reference] }])
      if (item) page.push(item)
    }
    return { ...result, page }
  },
})
