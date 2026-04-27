import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { requireGroupMember, requireReviewer } from './lib/permissions'

function inferDraftType(body: string) {
  const text = body.toLowerCase()
  if (text.includes('block') || text.includes('blocked')) return 'blocker'
  if (text.includes('decision') || text.includes('decide')) return 'decision'
  if (text.includes('scope') || text.includes('feature') || text.includes('change')) {
    return 'scope_change'
  }
  if (text.includes('question') || text.includes('?')) return 'question'
  if (text.includes('todo') || text.includes('action')) return 'action_item'
  return 'task'
}

function summarizeMessage(body: string) {
  const trimmed = body.trim().replace(/\s+/g, ' ')
  return trimmed.length > 110 ? `${trimmed.slice(0, 107)}...` : trimmed
}

export const latestForGroup = query({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId, args.userId)
    return await ctx.db
      .query('aiReviews')
      .withIndex('by_group_started_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .first()
  },
})

export const runReviewNow = mutation({
  args: {
    projectId: v.id('projects'),
    groupId: v.id('groups'),
    reviewerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.projectId, args.reviewerId)
    await requireGroupMember(ctx, args.groupId, args.reviewerId)

    const now = Date.now()
    const reviewId = await ctx.db.insert('aiReviews', {
      projectId: args.projectId,
      groupId: args.groupId,
      trigger: 'manual',
      status: 'running',
      startedAt: now,
      model: 'anthropic/claude-sonnet-4.6',
    })

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_group_created_at', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .take(40)

    const candidateMessages = messages
      .filter((message) => {
        const body = message.body.toLowerCase()
        return (
          body.includes('please') ||
          body.includes('need') ||
          body.includes('feature') ||
          body.includes('change') ||
          body.includes('scope') ||
          body.includes('blocked') ||
          body.includes('?') ||
          body.includes('@track')
        )
      })
      .slice(0, 5)

    for (const message of candidateMessages) {
      const title = summarizeMessage(message.body)
      await ctx.db.insert('draftRecords', {
        projectId: args.projectId,
        groupId: args.groupId,
        aiReviewId: reviewId,
        sourceMessageIds: [message._id],
        type: inferDraftType(message.body),
        title,
        description: `Track inferred this from the conversation: ${title}`,
        proposedStatus: 'open',
        proposedOwnerId: message.authorId,
        evidence: [
          {
            messageId: message._id,
            quote: summarizeMessage(message.body),
            reason: 'Conversation message matched Track review criteria.',
          },
        ],
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    }

    const summary =
      candidateMessages.length > 0
        ? `Track found ${candidateMessages.length} conversation items that may need review.`
        : 'Track did not find new review-worthy items in the recent conversation.'

    await ctx.db.patch(reviewId, {
      status: 'completed',
      finishedAt: Date.now(),
      lastReviewedMessageId: messages[0]?._id,
      lastReviewedAt: Date.now(),
      summary,
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      groupId: args.groupId,
      actorId: args.reviewerId,
      entityType: 'aiReview',
      entityId: reviewId,
      action: 'ai_review.completed',
      after: {
        draftCount: candidateMessages.length,
        model: 'anthropic/claude-sonnet-4.6',
      },
    })

    return { reviewId, draftCount: candidateMessages.length, summary }
  },
})
