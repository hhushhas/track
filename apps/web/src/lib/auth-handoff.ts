export type AuthMode = 'continue' | 'confirm-new' | 'google-proof' | 'set-password'

const workspacePath = '/workspace'

export function getAuthenticatedSignInDestination(hasSession: boolean, mode: AuthMode) {
  if (!hasSession || mode === 'set-password') return null
  return workspacePath
}

export function shouldFinishEmailAuthHandoff(authResult: unknown) {
  return !(
    typeof authResult === 'object' &&
    authResult !== null &&
    'twoFactorRedirect' in authResult &&
    authResult.twoFactorRedirect === true
  )
}

export function finishEmailAuthHandoff(location: Pick<Location, 'replace'> = window.location) {
  location.replace(workspacePath)
}
