export const devAuthBypassUser = {
  googleSubject: 'demo:track-developer',
  email: 'developer@track.local',
  displayName: 'Track Developer',
} as const

export const devAuthBypassStorageKey = 'track:dev-auth-bypass'

export function shouldAllowDevAuthBypass(input: {
  flag?: string | null
  isDev: boolean
}) {
  return input.isDev && input.flag === '1'
}

export function createDevAuthBypassSessionData() {
  return {
    user: {
      id: devAuthBypassUser.googleSubject,
      email: devAuthBypassUser.email,
      name: devAuthBypassUser.displayName,
    },
    session: {
      userId: devAuthBypassUser.googleSubject,
    },
  }
}
