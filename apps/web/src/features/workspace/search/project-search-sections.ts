import type { ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'

export type ProjectSearchSection = {
  key: 'messages' | 'files' | 'groups'
  label: string
  results: ProjectSearchResult[]
}

type ProjectSearchResultsPayload = {
  messages?: ProjectSearchResult[]
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
      key: 'files',
      label: 'Files',
      results: results?.files ?? [],
    },
    {
      key: 'groups',
      label: 'Channels',
      results: results?.groups ?? [],
    },
  ]
}

export function getProjectSearchTotal(sections: Array<ProjectSearchSection>) {
  return sections.reduce((total, section) => total + section.results.length, 0)
}
