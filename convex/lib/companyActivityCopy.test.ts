import { describe, expect, it } from 'vitest'
import { describeCompanyAuditActivity } from './companyActivityCopy'

describe('Company activity copy', () => {
  it('shows project creation in plain language', () => {
    expect(describeCompanyAuditActivity('company_project.created', 'Ava', 'Patient Portal')).toEqual({
      action: 'Created project',
      preview: 'Ava created the project Patient Portal.',
    })
  })

  it('omits internal events that have no supported Company feed meaning', () => {
    expect(describeCompanyAuditActivity('memory_tool.read.allowed', 'Ava', 'Patient Portal')).toBeNull()
  })
})
