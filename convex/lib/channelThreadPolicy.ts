import { resolveReleaseFeatureFlag } from '@track/shared/feature-flags'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type ThreadCtx = QueryCtx | MutationCtx

export function threadsEnabled() {
  return resolveReleaseFeatureFlag(process.env.TRACK_THREADS_ENABLED)
}

export function requireThreadsEnabled() {
  if (!threadsEnabled()) throw new Error('threads_disabled')
}

export async function resolveActorProjectMember(
  ctx: ThreadCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
  companyProjectMember?: Doc<'projectMembers'>,
) {
  if (companyProjectMember) return companyProjectMember
  const projectMember = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', (q) =>
      q.eq('projectId', projectId).eq('userId', userId),
    )
    .unique()
  if (!projectMember || (projectMember.status && projectMember.status !== 'active')) {
    throw new Error('thread_access_changed')
  }
  return projectMember
}

export async function allocateChannelSequence(
  ctx: MutationCtx,
  group: Doc<'groups'>,
) {
  const latestMessage = group.nextChannelSequence === undefined
    ? await ctx.db
        .query('messages')
        .withIndex('by_group_channel_sequence', (q) => q.eq('groupId', group._id))
        .order('desc')
        .first()
    : null
  const nextSequence = (group.nextChannelSequence ?? latestMessage?.channelSequence ?? 0) + 1
  await ctx.db.patch(group._id, { nextChannelSequence: nextSequence })
  return nextSequence
}

export async function upsertThreadFollower(
  ctx: MutationCtx,
  input: {
    thread: Doc<'channelThreads'>
    userId: Id<'users'>
    projectMember: Doc<'projectMembers'>
    actingCompanyId?: Id<'companies'>
    reason: Doc<'channelThreadFollowers'>['reason']
    preference?: Doc<'channelThreadFollowers'>['preference']
  },
) {
  const existing = await ctx.db
    .query('channelThreadFollowers')
    .withIndex('by_thread_project_member', (q) =>
      q
        .eq('channelThreadId', input.thread._id)
        .eq('projectMemberId', input.projectMember._id),
    )
    .unique()
  const now = Date.now()
  const preference = input.preference ?? 'following'
  if (existing) {
    await ctx.db.patch(existing._id, {
      actingCompanyId: input.actingCompanyId,
      preference,
      reason: input.reason,
      updatedAt: now,
    })
    return existing._id
  }
  return await ctx.db.insert('channelThreadFollowers', {
    projectId: input.thread.projectId,
    groupId: input.thread.groupId,
    channelThreadId: input.thread._id,
    userId: input.userId,
    projectMemberId: input.projectMember._id,
    actingCompanyId: input.actingCompanyId,
    reason: input.reason,
    preference,
    createdAt: now,
    updatedAt: now,
  })
}

export async function assertReplyScope(
  ctx: ThreadCtx,
  replyToMessageId: Id<'messages'> | undefined,
  input: {
    projectId: Id<'projects'>
    groupId: Id<'groups'>
    channelThreadId?: Id<'channelThreads'>
  },
) {
  if (!replyToMessageId) return
  const replyToMessage = await ctx.db.get(replyToMessageId)
  if (
    !replyToMessage ||
    replyToMessage.projectId !== input.projectId ||
    replyToMessage.groupId !== input.groupId ||
    replyToMessage.channelThreadId !== input.channelThreadId
  ) {
    throw new Error('reply_scope_mismatch')
  }
}

export async function followMentionedThreadMembers(
  ctx: MutationCtx,
  thread: Doc<'channelThreads'>,
  mentionedUserIds: Array<Id<'users'>>,
  mentionedProjectMemberIds?: Array<Id<'projectMembers'>>,
) {
  if (mentionedUserIds.length === 0) return
  const mentionedUsers = new Set(mentionedUserIds.map(String))
  const channelMemberships = await ctx.db
    .query('groupMembers')
    .withIndex('by_group', (q) => q.eq('groupId', thread.groupId))
    .collect()
  const eligible = []
  for (const channelMembership of channelMemberships) {
    if (channelMembership.status && channelMembership.status !== 'active') continue
    const projectMember = channelMembership.projectMemberId
      ? await ctx.db.get(channelMembership.projectMemberId)
      : await ctx.db
          .query('projectMembers')
          .withIndex('by_project_user', (q) =>
            q
              .eq('projectId', thread.projectId)
              .eq('userId', channelMembership.userId),
          )
          .unique()
    if (
      !projectMember ||
      (projectMember.status && projectMember.status !== 'active') ||
      !mentionedUsers.has(String(projectMember.userId))
    ) continue
    eligible.push({ channelMembership, projectMember })
  }
  const selectedMemberships = mentionedProjectMemberIds
    ? new Set(mentionedProjectMemberIds.map(String))
    : null
  const eligibleCounts = new Map<string, number>()
  for (const { projectMember } of eligible) {
    const userId = String(projectMember.userId)
    eligibleCounts.set(userId, (eligibleCounts.get(userId) ?? 0) + 1)
  }
  for (const { projectMember } of eligible) {
    if (selectedMemberships
      ? !selectedMemberships.has(String(projectMember._id))
      : eligibleCounts.get(String(projectMember.userId)) !== 1) continue
    await upsertThreadFollower(ctx, {
      thread,
      userId: projectMember.userId,
      projectMember,
      actingCompanyId: projectMember.companyId,
      reason: 'mentioned',
    })
  }
}
