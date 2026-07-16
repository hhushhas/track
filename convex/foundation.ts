import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireAuthenticatedActor } from './lib/actorContext'
import { resolveProjectChannelContext } from './lib/projectChannelPolicy'

export const getActorContext = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireAuthenticatedActor(ctx)
    return {
      authSubject: actor.authSubject,
      userId: actor.userId,
    }
  },
})

export const getProjectChannelContext = query({
  args: {
    projectId: v.id('projects'),
    groupId: v.optional(v.id('groups')),
    selectedProjectMemberId: v.optional(v.id('projectMembers')),
    actingCompanyId: v.optional(v.id('companies')),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx)
    const context = await resolveProjectChannelContext(ctx, { actor, ...args })
    if (args.groupId && !context.capabilities.canReadChannel) {
      throw new Error('channel_unavailable')
    }
    return {
      userId: actor.userId,
      projectId: context.project._id,
      projectMemberId: context.projectMember._id,
      groupId: context.groupId,
      groupMemberId: context.groupMemberId,
      actingCompanyId: context.actingCompanyId,
      capabilities: context.capabilities,
    }
  },
})
