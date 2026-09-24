import { describe, expect, it } from 'vitest'

import { deriveProjectTaskMetrics } from './projectOverviewMetrics'

describe('deriveProjectTaskMetrics', () => {
  it('uses workflow semantics and date boundaries without counting completed work as due', () => {
    const metrics = deriveProjectTaskMetrics([
      { category: 'completed', dueDate: '2026-09-01', stateName: 'Done' },
      { category: 'started', dueDate: '2026-09-16', stateName: 'Blocked' },
      { category: 'unstarted', dueDate: '2026-09-17', stateName: 'To do' },
      { category: 'started', dueDate: '2026-09-24', stateName: 'In progress' },
      { category: 'canceled', dueDate: '2026-09-10', stateName: 'Canceled' },
    ], '2026-09-17', '2026-09-24')

    expect(metrics).toEqual({
      blocked: 1, completed: 1, completion: 20, dueThisWeek: 2,
      open: 3, overdue: 1, total: 5,
    })
  })

  it('returns a stable zero state', () => {
    expect(deriveProjectTaskMetrics([], '2026-09-17', '2026-09-24')).toEqual({
      blocked: 0, completed: 0, completion: 0, dueThisWeek: 0,
      open: 0, overdue: 0, total: 0,
    })
  })

  it('counts a Done workflow state as completed even when its legacy category is not completed', () => {
    const metrics = deriveProjectTaskMetrics([
      { category: 'started', stateName: 'Done' },
      { category: 'started', stateName: 'In progress' },
    ], '2026-09-17', '2026-09-24')

    expect(metrics).toMatchObject({ completed: 1, completion: 50, open: 1 })
  })
})
