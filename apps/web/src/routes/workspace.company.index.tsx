import { createFileRoute, Navigate } from '@tanstack/react-router'

import { CompanyHubPage } from '#/features/company/CompanyHubPage'
import { resolveCompanyHubView, resolveCompanyTaskFilter, type CompanyHubView } from '#/features/company/company-view-state'

export const Route = createFileRoute('/workspace/company/')({
  validateSearch: (search: Record<string, unknown>) => search.view === undefined
    ? { taskFilter: search.taskFilter === undefined ? undefined : resolveCompanyTaskFilter(search.taskFilter) }
    : { view: resolveCompanyHubView(search.view), taskFilter: search.taskFilter === undefined ? undefined : resolveCompanyTaskFilter(search.taskFilter) },
  component: CompanyHubRoute,
})

function CompanyHubRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  if (search.view === 'settings') return <Navigate to="/workspace/company/settings" />
  const onViewChange = (view: CompanyHubView) => {
    void navigate({ search: (current) => ({ ...current, view }) })
  }
  return <CompanyHubPage initialTaskFilter={search.taskFilter} initialView={search.view} onViewChange={onViewChange} />
}
