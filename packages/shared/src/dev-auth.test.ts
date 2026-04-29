import { describe, expect, it } from 'vitest'

import {
  createDevAuthBypassSessionData,
  devAuthBypassUser,
  shouldAllowDevAuthBypass,
} from './dev-auth'

describe('dev auth bypass helpers', () => {
  it('only allows the bypass when the dev flag is enabled in development', () => {
    expect(shouldAllowDevAuthBypass({ flag: '1', isDev: true })).toBe(true)
    expect(shouldAllowDevAuthBypass({ flag: '0', isDev: true })).toBe(false)
    expect(shouldAllowDevAuthBypass({ flag: undefined, isDev: true })).toBe(false)
    expect(shouldAllowDevAuthBypass({ flag: '1', isDev: false })).toBe(false)
  })

  it('uses the fixed Hasan demo identity for synthetic sessions', () => {
    expect(createDevAuthBypassSessionData()).toEqual({
      user: {
        id: devAuthBypassUser.googleSubject,
        email: 'shasanshoaib@gmail.com',
        name: 'Hasan Shoaib',
      },
      session: {
        userId: devAuthBypassUser.googleSubject,
      },
    })
  })
})
