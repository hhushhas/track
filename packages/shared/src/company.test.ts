import { describe, expect, it } from 'vitest'

import { resolveCompanyProjectParticipationRole } from './company'

describe('resolveCompanyProjectParticipationRole', () => {
  it('distinguishes the owning Company from collaborators', () => {
    expect(resolveCompanyProjectParticipationRole('company-a', 'company-a')).toBe('owner')
    expect(resolveCompanyProjectParticipationRole('company-a', 'company-b')).toBe('collaborator')
  })

  it('does not infer ownership for existing Projects without an explicit owner', () => {
    expect(resolveCompanyProjectParticipationRole(undefined, 'company-a')).toBe('unassigned_legacy')
  })
})
