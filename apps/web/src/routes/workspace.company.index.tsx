import { createFileRoute } from '@tanstack/react-router'

import { CompanyHubPage } from '#/features/company/CompanyHubPage'
import { resolveCompanyHubView, type CompanyHubView } from '#/features/company/company-view-state'

export const Route = createFileRoute('/workspace/company/')({
  validateSearch: (search: Record<string, unknown>) => search.view === undefined
    ? {}
    : { view: resolveCompanyHubView(search.view) },
  component: CompanyHubRoute,
})

function CompanyHubRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onViewChange = (view: CompanyHubView) => {
    void navigate({ search: (current) => ({ ...current, view }) })
  }
  return <CompanyHubPage initialView={search.view} onViewChange={onViewChange} />
}
