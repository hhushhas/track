import { describe, expect, it } from 'vitest'

import { resolveProjectAccessProfile, resolveReleaseFeatureFlag } from './feature-flags'

describe('release feature contract', () => {
  it('keeps release flags default-on only for the exact true value', () => {
    expect(resolveReleaseFeatureFlag(undefined)).toBe(true)
    expect(resolveReleaseFeatureFlag('true')).toBe(true)
    expect(resolveReleaseFeatureFlag('false')).toBe(false)
    expect(resolveReleaseFeatureFlag('TRUE')).toBe(false)
    expect(resolveReleaseFeatureFlag('')).toBe(false)
  })
})

describe('Project access profile contract', () => {
  it('resolves explicit profiles and falls back to legacy', () => {
    expect(resolveProjectAccessProfile('legacy')).toBe('legacy')
    expect(resolveProjectAccessProfile('company')).toBe('company')
    expect(resolveProjectAccessProfile(undefined)).toBe('legacy')
    expect(resolveProjectAccessProfile(null)).toBe('legacy')
  })
})
