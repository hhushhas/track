import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { threadsEnabled } from './channelThreadPolicy'

export async function getGroupUnreadCount(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  projectMemberId?: Id<'projectMembers'>,
  cutoff?: number,
) {
  const MAX_UNREAD_MESSAGES_TO_SCAN = 1_001
  const group = await ctx.db.get(groupId)
  if (!group) return 0
  const resolvedProjectMemberId = projectMemberId ?? (await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', group.projectId).eq('userId', userId),
    )
    .unique())?._id
  const readState = projectMemberId
    ? await ctx.db.query('groupReadStates').withIndex('by_project_member_group', (q) =>
        q.eq('projectMemberId', projectMemberId).eq('groupId', groupId),
      ).unique()
    : await ctx.db.query('groupReadStates').withIndex('by_user_group', (q) =>
        q.eq('userId', userId).eq('groupId', groupId),
      ).unique()
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_group_thread_created_at', (q) => {
      const range = q.eq('groupId', groupId)
        .eq('channelThreadId', undefined)
        .gt('createdAt', readState?.lastReadAt ?? 0)
      return cutoff === undefined ? range : range.lte('createdAt', cutoff)
    })
    .order('desc')
    .take(MAX_UNREAD_MESSAGES_TO_SCAN)

  const timelineUnread = messages.filter((message) => {
    if (cutoff && message.createdAt > cutoff) return false
    const authoredBySelectedMembership = message.authorProjectMemberId
      ? message.authorProjectMemberId === resolvedProjectMemberId
      : message.authorId === userId
    if (authoredBySelectedMembership) return false
    if (!readState) return true
    return message.createdAt > readState.lastReadAt
  }).length
  if (!threadsEnabled() || !resolvedProjectMemberId) return timelineUnread

  const followedThreads = await ctx.db
    .query('channelThreadFollowers')
    .withIndex('by_project_member_preference', (q) =>
      q.eq('projectMemberId', resolvedProjectMemberId).eq('preference', 'following'),
    )
    .collect()
  const threadUnread = (await Promise.all(
    followedThreads
      .filter((follower) => follower.groupId === groupId)
      .map(async (follower) => {
        const readState = await ctx.db
          .query('channelThreadReadStates')
          .withIndex('by_thread_project_member', (q) =>
            q
              .eq('channelThreadId', follower.channelThreadId)
              .eq('projectMemberId', resolvedProjectMemberId),
          )
          .unique()
        const thread = await ctx.db.get(follower.channelThreadId)
        const latestChannelSequence = cutoff
          ? (await ctx.db
              .query('messages')
              .withIndex('by_thread_created_at', (q) =>
                q.eq('channelThreadId', follower.channelThreadId).lte('createdAt', cutoff),
              )
              .order('desc')
              .first())?.channelSequence ?? 0
          : thread?.latestChannelSequence ?? 0
        return latestChannelSequence > (readState?.lastReadChannelSequence ?? 0) ? 1 : 0
      }),
  )).reduce<number>((total, count) => total + count, 0)
  return Math.min(MAX_UNREAD_MESSAGES_TO_SCAN - 1, timelineUnread + threadUnread)
}
