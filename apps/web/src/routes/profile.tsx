import { createFileRoute } from '@tanstack/react-router'

import { ProfileSettingsPage, type ProfilePanel } from '#/features/profile/ProfileSettingsPage'

function resolveProfilePanel(value: unknown): ProfilePanel {
  return value === 'security' || value === 'methods' ? value : 'profile'
}

export const Route = createFileRoute('/profile')({
  validateSearch: (search: Record<string, unknown>) => search.panel === undefined
    ? {}
    : { panel: resolveProfilePanel(search.panel) },
  component: Profile,
})

function Profile() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ProfileSettingsPage
      initialPanel={search.panel}
      mode="settings"
      onPanelChange={(panel) => void navigate({ search: (current) => ({ ...current, panel }) })}
    />
  )
}
