import type { Id } from '../../../../../convex/_generated/dataModel'

export type RepresentedThreadContext = {
  actingCompanyId: Id<'companies'>
  projectMemberId: Id<'projectMembers'>
}

export function threadHref(
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  threadId: Id<'channelThreads'>,
  context?: RepresentedThreadContext,
  messageId?: Id<'messages'>,
) {
  const path = `/workspace/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(groupId)}/threads/${encodeURIComponent(threadId)}`
  const search = context
    ? `?${new URLSearchParams({
        companyId: context.actingCompanyId,
        membershipId: context.projectMemberId,
      })}`
    : ''
  const fragment = messageId ? `#message-${encodeURIComponent(messageId)}` : ''
  return `${path}${search}${fragment}`
}
