import { describe, expect, it } from 'vitest'

import type { ProjectSearchResult } from './ProjectSearchDialog'
import { buildProjectSearchSections, getProjectSearchTotal } from './project-search-sections'

function result(kind: ProjectSearchResult['kind'], id: string): ProjectSearchResult {
  return {
    createdAt: 1,
    groupName: 'Project',
    id,
    kind,
    preview: 'Preview',
    subtitle: 'Scope',
    title: id,
  }
}

describe('project search sections', () => {
  it('keeps every searchable Project resource in a stable order', () => {
    const sections = buildProjectSearchSections({
      files: [result('file', 'file')],
      groups: [result('group', 'channel')],
      messages: [result('message', 'message')],
      people: [result('person', 'person')],
      projects: [result('project', 'project')],
      tasks: [result('task', 'task')],
      threads: [result('thread', 'thread')],
    })

    expect(sections.map((section) => section.label)).toEqual([
      'Messages', 'Files', 'Threads', 'Channels', 'People', 'Projects', 'Tasks',
    ])
    expect(getProjectSearchTotal(sections)).toBe(7)
  })

  it('returns empty sections while a scoped query has no results', () => {
    const sections = buildProjectSearchSections(undefined)

    expect(sections).toHaveLength(7)
    expect(getProjectSearchTotal(sections)).toBe(0)
  })
})
