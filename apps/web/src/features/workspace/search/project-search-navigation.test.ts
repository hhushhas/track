import { describe, expect, it } from 'vitest'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import type { ProjectSearchResult } from './ProjectSearchDialog'
import {
  projectSearchDestinationCompanyId,
  projectSearchResultHref,
} from './project-search-navigation'

const scope = {
  actingCompanyId: 'company-a' as Id<'companies'>,
  projectId: 'project-a' as Id<'projects'>,
  projectMemberId: 'membership-a' as Id<'projectMembers'>,
}

function result(overrides: Partial<ProjectSearchResult>): ProjectSearchResult {
  return {
    createdAt: 1,
    groupName: 'General',
    id: 'result-a',
    kind: 'task',
    preview: 'Preview',
    subtitle: 'Subtitle',
    title: 'Result',
    ...overrides,
  }
}

describe('projectSearchResultHref', () => {
  it('keeps the represented Company identity in task destinations', () => {
    const href = projectSearchResultHref(result({ taskKey: 'T-123' }), scope)
    const url = new URL(href ?? '', 'https://track.local')

    expect(url.pathname).toBe('/workspace/projects/project-a/tasks')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      actingCompanyId: 'company-a',
      projectMemberId: 'membership-a',
      task: 'T-123',
      view: 'all',
    })
    expect(url.searchParams.has('companyId')).toBe(false)
    expect(url.searchParams.has('membershipId')).toBe(false)
  })

  it('opens Company-scoped people results in the available People view', () => {
    expect(projectSearchResultHref(result({ kind: 'person' }), scope)).toBe(
      '/workspace/company/?view=people',
    )
    expect(projectSearchDestinationCompanyId(result({ kind: 'person' }), scope)).toBe('company-a')
    expect(projectSearchDestinationCompanyId(result({ kind: 'person' }), {
      projectId: scope.projectId,
    })).toBeUndefined()
  })
})
