import { createFileRoute } from '@tanstack/react-router'

import { CompanyHubPage } from '#/features/company/CompanyHubPage'

export const Route = createFileRoute('/workspace/company')({
  component: CompanyHubPage,
})
