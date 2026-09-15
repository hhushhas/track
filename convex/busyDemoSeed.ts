import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { createUniqueTaskPublicKey } from './lib/taskData'
import { ensureStandardWorkflow } from './taskBoards'

const taskPriorities = ['urgent', 'high', 'medium', 'low', 'none'] as const

async function ensureBoard(ctx: MutationCtx, project: Doc<'projects'>, member: Doc<'projectMembers'>, now: number) {
  let board = await ctx.db.query('taskBoards')
    .withIndex('by_project_archived', (q) => q.eq('projectId', project._id).eq('archivedAt', undefined))
    .first()
  if (!board) {
    const boardId = await ctx.db.insert('taskBoards', {
      projectId: project._id,
      name: `${project.name} Board`,
      description: 'Busy local demo board for workflow testing.',
      rank: '00000001',
      isDefault: true,
      createdByProjectMemberId: member._id,
      actingCompanyId: member.companyId,
      createdAt: now,
      updatedAt: now,
    })
    board = await ctx.db.get(boardId)
  }
  if (!board) throw new Error(`busy_demo_board_missing:${project._id}`)
  await ensureStandardWorkflow(ctx, project._id, board._id, now)
  return board
}

async function ensureBusyProject(ctx: MutationCtx, project: Doc<'projects'>, now: number) {
  const members = await ctx.db.query('projectMembers')
    .withIndex('by_project', (q) => q.eq('projectId', project._id))
    .take(50)
  const groups = await ctx.db.query('groups')
    .withIndex('by_project', (q) => q.eq('projectId', project._id))
    .take(50)
  const member = members.find((candidate) => candidate.role === 'manager' || candidate.role === 'owner') ?? members[0]
  if (!member || groups.length === 0) return { messages: 0, threads: 0, tasks: 0 }

  const board = await ensureBoard(ctx, project, member, now)
  const states = await ctx.db.query('taskWorkflowStates')
    .withIndex('by_board_rank', (q) => q.eq('boardId', board._id))
    .order('asc')
    .take(20)
  if (states.length === 0) throw new Error(`busy_demo_workflow_missing:${project._id}`)

  let messages = 0
  let threads = 0
  let tasks = 0
  for (const [groupIndex, group] of groups.entries()) {
    const latest = await ctx.db.query('messages')
      .withIndex('by_group_channel_sequence', (q) => q.eq('groupId', group._id))
      .order('desc')
      .first()
    let sequence = latest?.channelSequence ?? 0
    const sourceIds: Array<Id<'messages'>> = []
    for (let round = 0; round < 4; round += 1) {
      const author = members[(groupIndex + round) % members.length]!
      const key = `busy-demo-message-${String(group._id)}-${round}`
      let message = await ctx.db.query('messages')
        .withIndex('by_author_idempotency', (q) => q.eq('authorProjectMemberId', author._id).eq('idempotencyKey', key))
        .unique()
      if (!message) {
        sequence += 1
        const messageId = await ctx.db.insert('messages', {
          projectId: project._id,
          groupId: group._id,
          authorId: author.userId,
          authorProjectMemberId: author._id,
          actingCompanyId: author.companyId,
          channelSequence: sequence,
          idempotencyKey: key,
          body: `${author.userDisplayNameSnapshot ?? 'A teammate'} shared a ${group.name} update for ${project.name}: review progress, risks, and the next handoff before the next check-in.`,
          mentions: [],
          mentionedProjectMemberIds: [],
          attachmentIds: [],
          createdAt: now - (groups.length - groupIndex) * 86_400_000 + round * 3_600_000,
        })
        message = await ctx.db.get(messageId)
        messages += 1
      }
      if (message) sourceIds.push(message._id)
    }

    const sourceMessage = sourceIds[0]
    if (!sourceMessage) continue
    const threadKey = `busy-demo-thread-${String(group._id)}`
    let thread = await ctx.db.query('channelThreads')
      .withIndex('by_group_idempotency', (q) => q.eq('groupId', group._id).eq('idempotencyKey', threadKey))
      .unique()
    if (!thread) {
      const creator = members[groupIndex % members.length]!
      const threadId = await ctx.db.insert('channelThreads', {
        projectId: project._id,
        groupId: group._id,
        name: `${group.name} delivery review`,
        sourceMessageId: sourceMessage,
        creatorUserId: creator.userId,
        creatorProjectMemberId: creator._id,
        actingCompanyId: creator.companyId,
        status: 'active',
        revision: 1,
        replyCount: 0,
        latestChannelSequence: sequence + 3,
        idempotencyKey: threadKey,
        createdAt: now - 86_400_000,
        updatedAt: now,
      })
      thread = await ctx.db.get(threadId)
      threads += 1
    }
    if (!thread) continue
    const existingReplies = await ctx.db.query('messages')
      .withIndex('by_thread_created_at', (q) => q.eq('channelThreadId', thread!._id))
      .collect()
    for (let replyIndex = existingReplies.length; replyIndex < 3; replyIndex += 1) {
      const author = members[(groupIndex + replyIndex + 1) % members.length]!
      sequence += 1
      const replyKey = `${threadKey}-reply-${replyIndex + 1}`
      const replyId = await ctx.db.insert('messages', {
        projectId: project._id,
        groupId: group._id,
        channelThreadId: thread._id,
        authorId: author.userId,
        authorProjectMemberId: author._id,
        actingCompanyId: author.companyId,
        channelSequence: sequence,
        idempotencyKey: replyKey,
        replyToMessageId: sourceMessage,
        body: `${author.userDisplayNameSnapshot ?? 'A teammate'} confirmed the handoff and added context for the ${project.name} delivery review.`,
        mentions: [],
        mentionedProjectMemberIds: [],
        attachmentIds: [],
        createdAt: now - 20 * 60_000 * (replyIndex + 1),
      })
      if (replyId) messages += 1
    }
    await ctx.db.patch(thread._id, {
      replyCount: 3,
      latestChannelSequence: sequence,
      latestReplyAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(group._id, { nextChannelSequence: sequence, updatedAt: now })
  }

  const taskStates = states.filter((state) => state.category !== 'canceled')
  for (let index = 0; index < 5; index += 1) {
    const assignee = members[index % members.length]!
    const key = `busy-demo-task-${String(project._id)}-${index + 1}`
    const existing = await ctx.db.query('tasks')
      .withIndex('by_project_idempotency', (q) => q.eq('projectId', project._id).eq('createIdempotencyKey', key))
      .unique()
    if (existing) continue
    const state = taskStates[index % taskStates.length]!
    await ctx.db.insert('tasks', {
      projectId: project._id,
      publicKey: await createUniqueTaskPublicKey(ctx, project._id),
      boardId: board._id,
      groupId: groups[index % groups.length]!._id,
      workflowStateId: state._id,
      rank: String(index + 1).padStart(8, '0'),
      title: `${project.name}: ${['Clarify scope', 'Review open risks', 'Prepare stakeholder update', 'Validate acceptance criteria', 'Close delivery follow-up'][index]}`,
      description: `Busy demo task for ${project.name}. Keep the decision, owner, and next action visible in the shared workspace.`,
      searchText: `${project.name} busy demo task delivery follow-up`.toLowerCase(),
      assigneeProjectMemberId: assignee._id,
      priority: taskPriorities[index],
      createdByProjectMemberId: member._id,
      actingCompanyId: member.companyId,
      revision: 1,
      createIdempotencyKey: key,
      createdAt: now - (index + 1) * 3_600_000,
      updatedAt: now,
    })
    tasks += 1
  }
  return { messages, threads, tasks }
}

export const seed = internalMutation({
  args: {},
  returns: v.object({ projects: v.number(), messages: v.number(), threads: v.number(), tasks: v.number() }),
  handler: async (ctx) => {
    const projects = (await ctx.db.query('projects').take(100)).filter((project) => project.status === 'active')
    let messages = 0
    let threads = 0
    let tasks = 0
    for (const project of projects) {
      const result = await ensureBusyProject(ctx, project, Date.now())
      messages += result.messages
      threads += result.threads
      tasks += result.tasks
    }
    return { projects: projects.length, messages, threads, tasks }
  },
})
