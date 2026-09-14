export type CompanyHubView =
  | 'overview'
  | 'projects'
  | 'relationships'
  | 'people'
  | 'settings'

export type CompanyProjectContextTab = 'tasks' | 'threads' | 'management'

export type CompanyProjectView = 'overview' | 'channels' | 'evidence' | 'settings'

export function resolveCompanyProjectView(value: unknown): CompanyProjectView {
  return value === 'overview' || value === 'evidence' || value === 'settings'
    ? value
    : 'channels'
}

export function resolveCompanyHubView(value: unknown): CompanyHubView {
  return value === 'projects' || value === 'relationships' || value === 'people' || value === 'settings'
    ? value
    : 'overview'
}

export function resolveCompanyProjectContextTab(value: unknown): CompanyProjectContextTab {
  return value === 'threads' ? 'threads' : value === 'manage' || value === 'management' ? 'management' : 'tasks'
}

export function companyProjectContextTabToSearch(tab: CompanyProjectContextTab) {
  return tab
}
