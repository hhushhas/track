import { describe, expect, it } from 'vitest'

import {
  defaultReleaseFeatureFlags,
  projectAccessProfiles,
  releaseFeatureNames,
  resolveProjectAccessProfile,
  resolveReleaseFeatureFlag,
  unavailableReleaseFeatureFlags,
} from './feature-flags'

describe('release feature contract', () => {
  it('defines three independent default-on controls', () => {
    expect(releaseFeatureNames).toEqual(['companyModel', 'tasks', 'threads'])
    expect(defaultReleaseFeatureFlags).toEqual({
      companyModel: true,
      tasks: true,
      threads: true,
    })
    expect(Object.isFrozen(defaultReleaseFeatureFlags)).toBe(true)
  })

  it('keeps clients closed until the server projection is available', () => {
    expect(unavailableReleaseFeatureFlags).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    })
    expect(Object.isFrozen(unavailableReleaseFeatureFlags)).toBe(true)
  })

  it('preserves exact server disable overrides', () => {
    expect(resolveReleaseFeatureFlag(undefined)).toBe(true)
    expect(resolveReleaseFeatureFlag('true')).toBe(true)
    expect(resolveReleaseFeatureFlag('false')).toBe(false)
    expect(resolveReleaseFeatureFlag('TRUE')).toBe(false)
    expect(resolveReleaseFeatureFlag('')).toBe(false)
  })
})

describe('Project access profile contract', () => {
  it('keeps the persisted profile independent from release flags', () => {
    expect(projectAccessProfiles).toEqual(['legacy', 'company'])
    expect(resolveProjectAccessProfile('legacy')).toBe('legacy')
    expect(resolveProjectAccessProfile('company')).toBe('company')
  })

  it('treats Projects created before the profile field as legacy', () => {
    expect(resolveProjectAccessProfile(undefined)).toBe('legacy')
    expect(resolveProjectAccessProfile(null)).toBe('legacy')
  })
})
