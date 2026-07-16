import type { ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'

export type ProjectSearchSection = {
  key: 'messages' | 'files' | 'groups' | 'tasks'
  label: string
  results: ProjectSearchResult[]
}

type ProjectSearchResultsPayload = {
  messages?: ProjectSearchResult[]
  files?: ProjectSearchResult[]
  groups?: ProjectSearchResult[]
  tasks?: ProjectSearchResult[]
} | null | undefined

export function buildProjectSearchSections(
  results: ProjectSearchResultsPayload,
): Array<ProjectSearchSection> {
  return [
    {
      key: 'messages',
      label: 'Messages',
      results: results?.messages ?? [],
    },
    {
      key: 'files',
      label: 'Files',
      results: results?.files ?? [],
    },
    {
      key: 'groups',
      label: 'Groups',
      results: results?.groups ?? [],
    },
    {
      key: 'tasks',
      label: 'Tasks',
      results: results?.tasks ?? [],
    },
  ]
}

export function getProjectSearchTotal(sections: Array<ProjectSearchSection>) {
  return sections.reduce((total, section) => total + section.results.length, 0)
}
