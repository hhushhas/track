import { createFileRoute } from '@tanstack/react-router'

import type { Id } from '../../../../convex/_generated/dataModel'
import { CompanyProjectPage } from '#/features/company/CompanyProjectPage'

export const Route = createFileRoute('/workspace/company-projects/$projectId')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: String(search.companyId ?? ''),
    membershipId: String(search.membershipId ?? ''),
  }),
  component: CompanyProjectRoute,
})

function CompanyProjectRoute() {
  const { projectId } = Route.useParams()
  const { companyId, membershipId } = Route.useSearch()
  return <CompanyProjectPage
    actingCompanyId={companyId as Id<'companies'>}
    projectId={projectId as Id<'projects'>}
    projectMemberId={membershipId as Id<'projectMembers'>}
  />
}
