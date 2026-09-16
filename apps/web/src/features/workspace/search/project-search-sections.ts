import type { ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'

export type ProjectSearchSection = {
  key: 'messages' | 'files' | 'threads' | 'groups' | 'people' | 'projects' | 'tasks'
  label: string
  results: ProjectSearchResult[]
}

type ProjectSearchResultsPayload = {
  messages?: ProjectSearchResult[]
  files?: ProjectSearchResult[]
  groups?: ProjectSearchResult[]
  people?: ProjectSearchResult[]
  projects?: ProjectSearchResult[]
  tasks?: ProjectSearchResult[]
  threads?: ProjectSearchResult[]
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
      key: 'threads',
      label: 'Threads',
      results: results?.threads ?? [],
    },
    {
      key: 'groups',
      label: 'Channels',
      results: results?.groups ?? [],
    },
    {
      key: 'people',
      label: 'People',
      results: results?.people ?? [],
    },
    {
      key: 'projects',
      label: 'Projects',
      results: results?.projects ?? [],
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
