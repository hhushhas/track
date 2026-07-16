import { describe, expect, it } from 'vitest'

import {
  defaultReleaseFeatureFlags,
  projectAccessProfiles,
  releaseFeatureNames,
  resolveProjectAccessProfile,
} from './feature-flags'

describe('release feature contract', () => {
  it('defines three independent default-off controls', () => {
    expect(releaseFeatureNames).toEqual(['companyModel', 'tasks', 'threads'])
    expect(defaultReleaseFeatureFlags).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    })
    expect(Object.isFrozen(defaultReleaseFeatureFlags)).toBe(true)
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
