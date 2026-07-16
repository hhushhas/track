import { describe, expect, it } from 'vitest'

import { resolveReleaseConfig } from './release-config'

describe('web release config', () => {
  it('boots in F000 while the server projection is unavailable', () => {
    expect(resolveReleaseConfig(undefined)).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    })
  })

  it('uses only the server projection once it is available', () => {
    expect(resolveReleaseConfig({
      companyModel: true,
      tasks: false,
      threads: true,
    })).toEqual({
      companyModel: true,
      tasks: false,
      threads: true,
    })
  })
})
