import { describe, expect, it } from 'vitest'

import type { Id } from '../../../../../convex/_generated/dataModel'
import { getCompanyProjectTaskSearch } from './company-project-links'

describe('Company Project links', () => {
  it('opens the shared task workspace in the all-task List view', () => {
    expect(getCompanyProjectTaskSearch({
      actingCompanyId: 'company-a' as Id<'companies'>,
      projectId: 'project-a' as Id<'projects'>,
      projectMemberId: 'member-a' as Id<'projectMembers'>,
    })).toEqual({
      actingCompanyId: 'company-a',
      groupId: '',
      projectMemberId: 'member-a',
      view: 'list',
    })
  })
})
