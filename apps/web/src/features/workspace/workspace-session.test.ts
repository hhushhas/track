import { describe, expect, it } from 'vitest'

import { getSessionDataForRender, getSessionUser } from './workspace-session'

describe('workspace session rendering', () => {
  const cachedSession = {
    session: { userId: 'cached-user' },
    user: { id: 'cached-user', email: 'cached@example.test', name: 'Cached User' },
  }

  it('uses cached session data only while the server check is pending', () => {
    expect(getSessionDataForRender(null, true, cachedSession)).toBe(cachedSession)
    expect(getSessionDataForRender(null, false, cachedSession)).toBeNull()
  })

  it('prefers current server session data over the cache', () => {
    const currentSession = { user: { id: 'current-user', email: 'current@example.test' } }
    expect(getSessionDataForRender(currentSession, true, cachedSession)).toBe(currentSession)
    expect(getSessionUser(currentSession)).toEqual({
      id: 'current-user',
      email: 'current@example.test',
      name: 'current',
    })
  })

})
