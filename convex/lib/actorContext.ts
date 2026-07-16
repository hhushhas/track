import type { Doc } from '../_generated/dataModel'
import type { QueryCtx, MutationCtx } from '../_generated/server'

type ActorCtx = QueryCtx | MutationCtx

export type AuthenticatedActor = Readonly<{
  authSubject: string
  user: Doc<'users'>
  userId: Doc<'users'>['_id']
}>

async function findTrackUserForIdentity(
  ctx: ActorCtx,
  identity: { subject: string },
) {
  const byAuthUserId = await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
    .unique()
  if (byAuthUserId) return byAuthUserId

  const byLegacySubject = await ctx.db
    .query('users')
    .withIndex('by_google_subject', (q) => q.eq('googleSubject', identity.subject))
    .unique()
  return byLegacySubject
}

export async function getOptionalAuthenticatedActor(
  ctx: ActorCtx,
): Promise<AuthenticatedActor | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const user = await findTrackUserForIdentity(ctx, identity)
  if (!user) throw new Error('actor_not_provisioned')

  return {
    authSubject: identity.subject,
    user,
    userId: user._id,
  }
}

export async function requireAuthenticatedActor(ctx: ActorCtx) {
  const actor = await getOptionalAuthenticatedActor(ctx)
  if (!actor) throw new Error('unauthenticated')
  return actor
}

export function assertActorMatches(
  actor: AuthenticatedActor,
  claimedUserId: Doc<'users'>['_id'],
) {
  if (actor.userId !== claimedUserId) throw new Error('actor_mismatch')
  return actor
}
