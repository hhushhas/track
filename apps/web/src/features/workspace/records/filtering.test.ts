import { describe, expect, it } from 'vitest'

import { filterProjectRecords } from './filtering'

const records = [
  {
    _id: 'record-open',
    title: 'Open scope',
    description: 'Needs review',
    type: 'decision',
    classification: 'billable_scope',
    status: 'open',
  },
  {
    _id: 'record-progress',
    title: 'In progress item',
    description: 'Client blocker',
    type: 'risk',
    classification: 'non_billable',
    status: 'in_progress',
  },
  {
    _id: 'record-blocked',
    title: 'Blocked item',
    description: 'Waiting on access',
    type: 'risk',
    classification: 'non_billable',
    status: 'blocked',
  },
  {
    _id: 'record-done',
    title: 'Done item',
    description: 'Completed',
    type: 'decision',
    classification: 'non_billable',
    status: 'done',
  },
] as Parameters<typeof filterProjectRecords>[0]

describe('workspace record filtering', () => {
  it('treats open records as open or in progress', () => {
    expect(filterProjectRecords(records, 'open', '').map((record) => record._id)).toEqual([
      'record-open',
      'record-progress',
    ])
  })

  it('filters billable, blocked, and done records by canonical fields', () => {
    expect(filterProjectRecords(records, 'billable', '').map((record) => record._id)).toEqual(['record-open'])
    expect(filterProjectRecords(records, 'blocked', '').map((record) => record._id)).toEqual(['record-blocked'])
    expect(filterProjectRecords(records, 'done', '').map((record) => record._id)).toEqual(['record-done'])
  })

  it('searches title, description, type, classification, and status after applying the filter', () => {
    expect(filterProjectRecords(records, 'all', 'client').map((record) => record._id)).toEqual(['record-progress'])
    expect(filterProjectRecords(records, 'open', 'risk').map((record) => record._id)).toEqual(['record-progress'])
  })
})
