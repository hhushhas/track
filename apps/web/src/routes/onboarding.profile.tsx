import { createFileRoute } from '@tanstack/react-router'

import { ProfileSettingsPage } from '#/features/profile/ProfileSettingsPage'

export const Route = createFileRoute('/onboarding/profile')({
  component: OnboardingProfile,
})

function OnboardingProfile() {
  return <ProfileSettingsPage mode="onboarding" />
}
