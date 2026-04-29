import { createFileRoute } from '@tanstack/react-router'

import { ProfileSettingsPage } from '#/features/profile/ProfileSettingsPage'

export const Route = createFileRoute('/profile')({
  component: Profile,
})

function Profile() {
  return <ProfileSettingsPage mode="settings" />
}
