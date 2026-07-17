import { createFileRoute } from '@tanstack/react-router'

import type { Id } from '../../../../convex/_generated/dataModel'
import { ThreadConversationPage } from '#/features/threads/ThreadConversationPage'

export const Route = createFileRoute('/workspace/projects/$projectId/groups/$groupId/threads/$threadId')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: typeof search.companyId === 'string' ? search.companyId : '',
    membershipId: typeof search.membershipId === 'string' ? search.membershipId : '',
  }),
  component: ThreadRoute,
})

function ThreadRoute() {
  const { groupId, projectId, threadId } = Route.useParams()
  const { companyId, membershipId } = Route.useSearch()
  const context = companyId && membershipId
    ? {
        actingCompanyId: companyId as Id<'companies'>,
        projectMemberId: membershipId as Id<'projectMembers'>,
      }
    : undefined
  return <ThreadConversationPage
    context={context}
    groupId={groupId as Id<'groups'>}
    projectId={projectId as Id<'projects'>}
    threadId={threadId as Id<'channelThreads'>}
  />
}
