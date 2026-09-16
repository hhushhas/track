type ProjectItem = {
  project: { accessProfile?: string; _id?: string }
  membership?: { _id?: string; status?: string }
  company?: { _id: string } | null
  projectStatus?: 'proposed' | 'active' | 'archive_pending' | 'archived'
  lastActivityAt?: number
}

type WorkspaceView = 'home' | 'project' | 'channels' | 'group' | 'evidence' | 'settings'

export function isResolvedLegacyProject(projectItem: ProjectItem | undefined) {
  if (!projectItem) return false
  return projectItem.project.accessProfile === undefined || projectItem.project.accessProfile === 'legacy'
}

export function shouldSelectFallbackProject(
  view: WorkspaceView,
  projectCount: number,
  activeProjectId: string | null,
) {
  return view !== 'home' && projectCount > 0 && !activeProjectId
}

export function shouldProvisionStarterProject(view: WorkspaceView, projectCount: number) {
  return view !== 'home' && projectCount === 0
}

const projectStatusPriority = {
  active: 0,
  proposed: 1,
  archive_pending: 2,
  archived: 3,
} as const

export function selectTopCompanyProject<T extends ProjectItem>(
  projects: Array<T>,
  companyId: string | null,
) {
  if (!companyId) return undefined
  return [...projects]
    .filter((item) =>
      item.company?._id === companyId &&
      item.membership?.status !== 'archived' &&
      item.projectStatus !== 'archived',
    )
    .sort((left, right) => {
      const leftStatus = left.projectStatus ? projectStatusPriority[left.projectStatus] : 0
      const rightStatus = right.projectStatus ? projectStatusPriority[right.projectStatus] : 0
      return leftStatus - rightStatus || (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0)
    })[0]
}

export function companyProjectViewFromWorkspaceView(view: WorkspaceView) {
  if (view === 'project') return 'overview' as const
  if (view === 'evidence') return 'evidence' as const
  if (view === 'settings') return 'settings' as const
  return 'channels' as const
}
