import { describe, expect, it } from 'vitest'

import {
  parseReleaseFeatureFlag,
  readReleaseFeatureFlags,
} from './releaseConfig'

describe('release flag parser', () => {
  it.each([undefined, '', 'false', '1', 'TRUE', 'yes', ' true '])(
    'fails closed for %s',
    (value) => {
      expect(parseReleaseFeatureFlag(value)).toBe(false)
    },
  )

  it('enables a flag only for the exact true value', () => {
    expect(parseReleaseFeatureFlag('true')).toBe(true)
  })
})

describe('release config projection', () => {
  it('defaults every missing flag off', () => {
    expect(readReleaseFeatureFlags({})).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    })
  })

  it.each([
    ['TRACK_COMPANY_MODEL_ENABLED', { companyModel: true, tasks: false, threads: false }],
    ['TRACK_TASKS_ENABLED', { companyModel: false, tasks: true, threads: false }],
    ['TRACK_THREADS_ENABLED', { companyModel: false, tasks: false, threads: true }],
  ] as const)('projects %s independently', (environmentName, expected) => {
    expect(readReleaseFeatureFlags({ [environmentName]: 'true' })).toEqual(expected)
  })
})
