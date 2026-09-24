import { describe, expect, it } from 'vitest'

import { canManageTaskProject } from './task-types'

describe('task project capabilities', () => {
  it.each(['manager', 'owner', 'admin'] as const)('allows task administration for %s', (role) => {
    expect(canManageTaskProject(role)).toBe(true)
  })

  it.each(['member', 'staff', 'client', undefined] as const)('hides task administration for %s', (role) => {
    expect(canManageTaskProject(role)).toBe(false)
  })
})
