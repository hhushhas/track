import type { Id } from '../../../../../../convex/_generated/dataModel'
import { resolveMentionedUserIds } from '#/features/workspace/chat/message-send'
import type {
  WorkspaceChannelMember,
  WorkspaceMentionOption,
} from '#/features/workspace/lib/mentions'

export function resolveScopedMentionRecipients(
  mentionHandles: Array<string>,
  mentionOptions: Array<WorkspaceMentionOption>,
  channelMembers: Array<WorkspaceChannelMember>,
) {
  const mentionedUserIds = resolveMentionedUserIds(mentionHandles, mentionOptions)
  const mentionedProjectMemberIds: Array<Id<'projectMembers'>> = []
  const seenProjectMembers = new Set<string>()

  for (const member of channelMembers) {
    const projectMemberId = member.membership.projectMemberId
    if (!projectMemberId || !mentionedUserIds.includes(member.user._id)) continue
    if (seenProjectMembers.has(projectMemberId)) continue
    seenProjectMembers.add(projectMemberId)
    mentionedProjectMemberIds.push(projectMemberId)
  }

  return { mentionedProjectMemberIds, mentionedUserIds }
}
