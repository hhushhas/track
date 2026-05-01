import type { ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'

export type ProjectSearchSection = {
  key: 'messages' | 'records' | 'files' | 'groups'
  label: string
  results: ProjectSearchResult[]
}

type ProjectSearchResultsPayload = {
  messages?: ProjectSearchResult[]
  records?: ProjectSearchResult[]
  files?: ProjectSearchResult[]
  groups?: ProjectSearchResult[]
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
      key: 'records',
      label: 'Records',
      results: results?.records ?? [],
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
  ]
}

export function getProjectSearchTotal(sections: Array<ProjectSearchSection>) {
  return sections.reduce((total, section) => total + section.results.length, 0)
}
