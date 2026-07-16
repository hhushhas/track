import { createFileRoute } from '@tanstack/react-router'

import type { Id } from '../../../../convex/_generated/dataModel'
import { CompanyProjectPage } from '#/features/company/CompanyProjectPage'

export const Route = createFileRoute('/workspace/company-projects/$projectId')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: String(search.companyId ?? ''),
    groupId: String(search.groupId ?? ''),
    membershipId: String(search.membershipId ?? ''),
  }),
  component: CompanyProjectRoute,
})

function CompanyProjectRoute() {
  const { projectId } = Route.useParams()
  const { companyId, groupId, membershipId } = Route.useSearch()
  return <CompanyProjectPage
    actingCompanyId={companyId as Id<'companies'>}
    initialGroupId={groupId ? groupId as Id<'groups'> : undefined}
    projectId={projectId as Id<'projects'>}
    projectMemberId={membershipId as Id<'projectMembers'>}
  />
}
