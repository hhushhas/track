import { describe, expect, it } from 'vitest'

import {
  companyProjectContextTabToSearch,
  resolveCompanyHubView,
  resolveCompanyProjectContextTab,
  resolveCompanyProjectView,
} from './company-view-state'

describe('Company view state', () => {
  it('keeps only supported Company views in the URL', () => {
    expect(resolveCompanyHubView('settings')).toBe('settings')
    expect(resolveCompanyHubView('unknown')).toBe('overview')
    expect(resolveCompanyHubView(undefined)).toBe('overview')
  })

  it('normalizes the management tab without exposing an implementation name', () => {
    expect(resolveCompanyProjectContextTab('manage')).toBe('management')
    expect(resolveCompanyProjectContextTab('management')).toBe('management')
    expect(resolveCompanyProjectContextTab('threads')).toBe('threads')
    expect(companyProjectContextTabToSearch('management')).toBe('management')
  })

  it('keeps only supported Project workspace views in the URL', () => {
    expect(resolveCompanyProjectView('overview')).toBe('overview')
    expect(resolveCompanyProjectView('evidence')).toBe('evidence')
    expect(resolveCompanyProjectView('settings')).toBe('settings')
    expect(resolveCompanyProjectView('unknown')).toBe('channels')
  })
})
