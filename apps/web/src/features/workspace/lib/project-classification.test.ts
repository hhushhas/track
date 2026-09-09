import { describe, expect, it } from 'vitest'

import {
  companyProjectViewFromWorkspaceView,
  isResolvedLegacyProject,
  selectTopCompanyProject,
  shouldProvisionStarterProject,
  shouldSelectFallbackProject,
} from './project-classification'

describe('workspace project classification', () => {
  it('does not start legacy queries before the accessible-project query resolves', () => {
    expect(isResolvedLegacyProject(undefined)).toBe(false)
  })

  it('recognizes explicit and pre-profile legacy projects only after resolution', () => {
    expect(isResolvedLegacyProject({ project: {} })).toBe(true)
    expect(isResolvedLegacyProject({ project: { accessProfile: 'legacy' } })).toBe(true)
    expect(isResolvedLegacyProject({ project: { accessProfile: 'company' } })).toBe(false)
  })

  it('keeps the Project directory stable and selects a fallback only on Project routes', () => {
    expect(shouldSelectFallbackProject('home', 3, null)).toBe(false)
    expect(shouldSelectFallbackProject('channels', 3, null)).toBe(true)
    expect(shouldSelectFallbackProject('channels', 3, 'project-1')).toBe(false)
    expect(shouldSelectFallbackProject('channels', 0, null)).toBe(false)
  })

  it('does not create a starter Project while viewing the Project directory', () => {
    expect(shouldProvisionStarterProject('home', 0)).toBe(false)
    expect(shouldProvisionStarterProject('channels', 0)).toBe(true)
    expect(shouldProvisionStarterProject('channels', 1)).toBe(false)
  })

  it('selects the most recently active Project in the represented Company', () => {
    const projects = [
      { company: { _id: 'company-1' }, lastActivityAt: 300, project: { _id: 'archived' }, projectStatus: 'archived' as const },
      { company: { _id: 'company-1' }, lastActivityAt: 400, membership: { status: 'archived' }, project: { _id: 'exited' }, projectStatus: 'active' as const },
      { company: { _id: 'company-2' }, lastActivityAt: 500, project: { _id: 'other' }, projectStatus: 'active' as const },
      { company: { _id: 'company-1' }, lastActivityAt: 100, project: { _id: 'older' }, projectStatus: 'active' as const },
      { company: { _id: 'company-1' }, lastActivityAt: 200, project: { _id: 'top' }, projectStatus: 'active' as const },
    ]

    expect(selectTopCompanyProject(projects, 'company-1')?.project._id).toBe('top')
    expect(selectTopCompanyProject(projects, 'missing')).toBeUndefined()
  })

  it('preserves the requested surface when translating a company project route', () => {
    expect(companyProjectViewFromWorkspaceView('project')).toBe('overview')
    expect(companyProjectViewFromWorkspaceView('channels')).toBe('channels')
    expect(companyProjectViewFromWorkspaceView('group')).toBe('channels')
    expect(companyProjectViewFromWorkspaceView('evidence')).toBe('evidence')
    expect(companyProjectViewFromWorkspaceView('settings')).toBe('settings')
  })
})
