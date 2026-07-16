import { resolveRelationshipStatus } from '@track/shared/company'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function getActiveRelationshipCompanies(
  ctx: MutationCtx,
  relationshipId: Id<'relationships'>,
) {
  return await ctx.db
    .query('relationshipCompanies')
    .withIndex('by_relationship_status', (q) =>
      q.eq('relationshipId', relationshipId).eq('status', 'active'),
    )
    .collect()
}

export async function markRelationshipRequestsStale(
  ctx: MutationCtx,
  relationshipId: Id<'relationships'>,
  now: number,
) {
  const pending = await ctx.db
    .query('relationshipRemovalRequests')
    .withIndex('by_relationship_status', (q) =>
      q.eq('relationshipId', relationshipId).eq('status', 'pending'),
    )
    .collect()
  await Promise.all(pending.map((request) =>
    ctx.db.patch(request._id, { status: 'stale', updatedAt: now }),
  ))
}

export async function refreshRelationshipAfterParticipantChange(
  ctx: MutationCtx,
  relationshipId: Id<'relationships'>,
  now: number,
) {
  const relationship = await ctx.db.get(relationshipId)
  if (!relationship) throw new Error('relationship_unavailable')
  const active = await getActiveRelationshipCompanies(ctx, relationshipId)
  const status = resolveRelationshipStatus(active.length)
  const participantRevision = relationship.participantRevision + 1
  await ctx.db.patch(relationship._id, {
    status,
    participantRevision,
    revision: relationship.revision + 1,
    closedAt: status === 'closed' ? now : undefined,
    updatedAt: now,
  })
  await markRelationshipRequestsStale(ctx, relationshipId, now)
  return { active, participantRevision, status }
}
