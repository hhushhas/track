import { createFileRoute } from '@tanstack/react-router'
import { SignInExperience } from './sign-in'

export const Route = createFileRoute('/sign-in-option-b')({
  component: () => <SignInExperience variant="conversation-b" />,
})
