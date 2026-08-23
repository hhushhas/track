import { describe, expect, it } from 'vitest'

import { resolveReleaseConfig } from './release-config'

describe('web release config', () => {
  it('fails closed while the server projection is unavailable', () => {
    expect(resolveReleaseConfig(undefined)).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    })
  })
})
