import { describe, expect, it, vi } from 'vitest'

import {
  finishEmailAuthHandoff,
  getAuthenticatedSignInDestination,
  shouldFinishEmailAuthHandoff,
} from './auth-handoff'

describe('authentication handoff', () => {
  it('sends an authenticated sign-in page to the workspace', () => {
    expect(getAuthenticatedSignInDestination(true, 'continue')).toBe('/workspace')
  })

  it('keeps the password setup step on the sign-in page', () => {
    expect(getAuthenticatedSignInDestination(true, 'set-password')).toBeNull()
  })

  it('keeps an unauthenticated visitor on the sign-in page', () => {
    expect(getAuthenticatedSignInDestination(false, 'continue')).toBeNull()
  })

  it('preserves the two-factor verification redirect', () => {
    expect(shouldFinishEmailAuthHandoff({ twoFactorRedirect: true })).toBe(false)
    expect(shouldFinishEmailAuthHandoff({ token: 'session-token' })).toBe(true)
  })

  it('finishes email authentication with a full document navigation', () => {
    const replace = vi.fn()

    finishEmailAuthHandoff({ replace })

    expect(replace).toHaveBeenCalledWith('/workspace')
  })
})
