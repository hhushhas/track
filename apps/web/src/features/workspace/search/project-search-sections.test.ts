import { describe, expect, it } from 'vitest'

import { buildProjectSearchSections, getProjectSearchTotal } from './project-search-sections'

describe('workspace project search sections', () => {
  it('preserves the project search section order and labels', () => {
    expect(buildProjectSearchSections(null).map(({ key, label }) => [key, label])).toEqual([
      ['messages', 'Messages'],
      ['files', 'Files'],
      ['groups', 'Groups'],
      ['tasks', 'Tasks'],
    ])
  })

  it('maps missing result buckets to empty arrays and totals all visible results', () => {
    const sections = buildProjectSearchSections({
      messages: [{ id: 'message' }],
      files: [{ id: 'file-1' }, { id: 'file-2' }],
    } as Parameters<typeof buildProjectSearchSections>[0])

    expect(sections.map((section) => section.results.map((result) => result.id))).toEqual([
      ['message'],
      ['file-1', 'file-2'],
      [],
      [],
    ])
    expect(getProjectSearchTotal(sections)).toBe(3)
  })
})
