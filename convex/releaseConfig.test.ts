import { describe, expect, it } from 'vitest'

import {
  parseReleaseFeatureFlag,
  readReleaseFeatureFlags,
} from './releaseConfig'

describe('release flag parser', () => {
  it.each(['', 'false', '1', 'TRUE', 'yes', ' true '])(
    'fails closed for %s',
    (value) => {
      expect(parseReleaseFeatureFlag(value)).toBe(false)
    },
  )

  it('enables a missing flag by default or an exact true override', () => {
    expect(parseReleaseFeatureFlag(undefined)).toBe(true)
    expect(parseReleaseFeatureFlag('true')).toBe(true)
  })
})

describe('release config projection', () => {
  it('defaults every missing flag on', () => {
    expect(readReleaseFeatureFlags({})).toEqual({
      companyModel: true,
      tasks: true,
      threads: true,
    })
  })

  it.each([
    ['TRACK_COMPANY_MODEL_ENABLED', { companyModel: false, tasks: true, threads: true }],
    ['TRACK_TASKS_ENABLED', { companyModel: true, tasks: false, threads: true }],
    ['TRACK_THREADS_ENABLED', { companyModel: true, tasks: true, threads: false }],
  ] as const)('projects the %s disable override independently', (environmentName, expected) => {
    expect(readReleaseFeatureFlags({ [environmentName]: 'false' })).toEqual(expected)
  })

  it.each([
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true],
  ] as const)('preserves the independent C%s T%s H%s combination', (companyModel, tasks, threads) => {
    expect(readReleaseFeatureFlags({
      TRACK_COMPANY_MODEL_ENABLED: companyModel ? 'true' : 'false',
      TRACK_TASKS_ENABLED: tasks ? 'true' : 'false',
      TRACK_THREADS_ENABLED: threads ? 'true' : 'false',
    })).toEqual({ companyModel, tasks, threads })
  })
})
