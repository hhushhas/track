export type CompanyHubView =
  | 'overview'
  | 'tasks'
  | 'threads'
  | 'projects'
  | 'relationships'
  | 'people'
  | 'settings'

export type CompanyTaskFilter = 'all' | 'active' | 'completed' | 'due-soon' | 'overdue' | 'blocked' | 'unassigned'

export type CompanyProjectContextTab = 'tasks' | 'threads' | 'management'

export type CompanyProjectView = 'overview' | 'channels' | 'evidence' | 'settings'

export function resolveCompanyProjectView(value: unknown): CompanyProjectView {
  return value === 'overview' || value === 'evidence' || value === 'settings'
    ? value
    : 'channels'
}

export function resolveCompanyHubView(value: unknown): CompanyHubView {
  if (value === 'work') return 'tasks'
  return value === 'tasks' || value === 'threads' || value === 'projects' || value === 'relationships' || value === 'people' || value === 'settings'
    ? value
    : 'overview'
}

export function resolveCompanyTaskFilter(value: unknown): CompanyTaskFilter {
  return value === 'active' || value === 'completed' || value === 'due-soon' || value === 'overdue' || value === 'blocked' || value === 'unassigned' ? value : 'all'
}

export function resolveCompanyProjectContextTab(value: unknown): CompanyProjectContextTab {
  return value === 'threads' ? 'threads' : value === 'manage' || value === 'management' ? 'management' : 'tasks'
}

export function companyProjectContextTabToSearch(tab: CompanyProjectContextTab) {
  return tab
}
