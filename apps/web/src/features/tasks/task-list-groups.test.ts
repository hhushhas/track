import { describe, expect, it } from 'vitest'

import { groupTaskListItems, type TaskListItemState } from './task-list-groups'

type Fixture = {
  id: string
  state: TaskListItemState | null
}

describe('task list groups', () => {
  it('aggregates equivalent statuses across boards without losing task order or identity', () => {
    const items: Array<Fixture> = [
      { id: 'task-1', state: { boardName: 'Delivery', category: 'unstarted', name: 'To do' } },
      { id: 'task-2', state: { boardName: 'Approvals', category: 'completed', name: 'Done' } },
      { id: 'task-3', state: { boardName: 'Approvals', category: 'unstarted', name: '  to   DO ' } },
      { id: 'task-4', state: { boardName: 'Delivery', category: 'completed', name: 'Done' } },
    ]

    const groups = groupTaskListItems(items, (item) => item.state)

    expect(groups.map((group) => ({
      category: group.category,
      ids: group.items.map((item) => item.id),
      label: group.label,
    }))).toEqual([
      { category: 'unstarted', ids: ['task-1', 'task-3'], label: 'To do' },
      { category: 'completed', ids: ['task-2', 'task-4'], label: 'Done' },
    ])
    expect(new Set(groups.flatMap((group) => group.items.map((item) => item.id)))).toEqual(
      new Set(items.map((item) => item.id)),
    )
  })

  it('keeps distinct custom statuses separate and qualifies ambiguous names', () => {
    const items: Array<Fixture> = [
      { id: 'task-1', state: { boardName: 'Delivery', category: 'started', name: 'Review' } },
      { id: 'task-2', state: { boardName: 'Compliance', category: 'completed', name: 'Review' } },
      { id: 'task-3', state: { boardName: 'Delivery', category: 'unstarted', name: 'Ready for build' } },
      { id: 'task-4', state: { boardName: 'Compliance', category: 'unstarted', name: 'Ready for client' } },
    ]

    const groups = groupTaskListItems(items, (item) => item.state)

    expect(groups.map((group) => group.label)).toEqual([
      'Review · Delivery · Started',
      'Review · Compliance · Completed',
      'Ready for build',
      'Ready for client',
    ])
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ['task-1'],
      ['task-2'],
      ['task-3'],
      ['task-4'],
    ])
  })

  it('keeps unavailable states in one explicit group', () => {
    const items: Array<Fixture> = [
      { id: 'task-1', state: null },
      { id: 'task-2', state: null },
    ]

    const groups = groupTaskListItems(items, (item) => item.state)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Unavailable state')
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['task-1', 'task-2'])
  })
})
