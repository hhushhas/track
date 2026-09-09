import { describe, expect, it } from 'vitest'

import { resolveActiveCompanyProjectChannel } from './company-project-channel-state'

describe('company project channel selection', () => {
  it('preserves a requested channel while the channel query is loading', () => {
    expect(resolveActiveCompanyProjectChannel('design', undefined)).toBe('design')
  })

  it('preserves an available requested channel and falls back only after loading', () => {
    expect(resolveActiveCompanyProjectChannel('design', ['general', 'design'])).toBe('design')
    expect(resolveActiveCompanyProjectChannel('missing', ['general', 'design'])).toBe('general')
    expect(resolveActiveCompanyProjectChannel('missing', [])).toBeNull()
  })
})
