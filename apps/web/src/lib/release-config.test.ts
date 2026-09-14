import { describe, expect, it } from 'vitest'

import { resolveReleaseConfig, resolveReleaseConfigState } from './release-config'

describe('web release config', () => {
  it('fails closed while the server projection is unavailable', () => {
    expect(resolveReleaseConfig(undefined)).toEqual({
      companyModel: false,
      projectSnapshots: false,
      tasks: false,
      threads: false,
    })
  })

  it('keeps loading separate from a disabled server projection', () => {
    expect(resolveReleaseConfigState(undefined)).toEqual({
      status: 'loading',
      config: {
        companyModel: false,
        projectSnapshots: false,
        tasks: false,
        threads: false,
      },
    })
    expect(resolveReleaseConfigState(null)).toEqual({
      status: 'ready',
      config: {
        companyModel: false,
        projectSnapshots: false,
        tasks: false,
        threads: false,
      },
    })
  })

  it('does not call a capability that an older backend has not advertised', () => {
    expect(resolveReleaseConfig({ companyModel: true, tasks: true, threads: true })).toEqual({
      companyModel: true,
      projectSnapshots: false,
      tasks: true,
      threads: true,
    })
  })
})
