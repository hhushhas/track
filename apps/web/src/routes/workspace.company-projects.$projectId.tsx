import { createFileRoute } from '@tanstack/react-router'

import type { Id } from '../../../../convex/_generated/dataModel'
import { CompanyProjectPage } from '#/features/company/CompanyProjectPage'
import {
  resolveCompanyProjectContextTab,
  resolveCompanyProjectView,
} from '#/features/company/company-view-state'

export const Route = createFileRoute('/workspace/company-projects/$projectId')({
  validateSearch: (search: Record<string, unknown>) => {
    const base = {
      companyId: String(search.companyId ?? ''),
      groupId: String(search.groupId ?? ''),
      membershipId: String(search.membershipId ?? ''),
      view: resolveCompanyProjectView(search.view),
    }
    return search.context === undefined
      ? base
      : { ...base, context: resolveCompanyProjectContextTab(search.context) }
  },
  component: CompanyProjectRoute,
})

function CompanyProjectRoute() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  const { companyId, groupId, membershipId } = search
  const context = 'context' in search ? search.context : undefined
  return <CompanyProjectPage
    actingCompanyId={companyId as Id<'companies'>}
    initialGroupId={groupId ? groupId as Id<'groups'> : undefined}
    projectId={projectId as Id<'projects'>}
    projectMemberId={membershipId as Id<'projectMembers'>}
    contextTab={context}
    view={search.view}
  />
}
