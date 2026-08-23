import { describe, expect, it } from 'vitest'

import {
  getTaskDueState,
  isTaskDescription,
  isTaskDueDate,
  isTaskTitle,
  resolveTaskCapabilities,
  taskSuggestionFingerprint,
} from './tasks'

describe('task domain contracts', () => {
  it('enforces date, title, description, and due-state boundaries', () => {
    expect(isTaskDueDate('2026-02-29')).toBe(false)
    expect(isTaskDueDate('2028-02-29')).toBe(true)
    expect(isTaskTitle('  Ship the task release  ')).toBe(true)
    expect(isTaskTitle('   ')).toBe(false)
    expect(isTaskTitle('x'.repeat(181))).toBe(false)
    expect(isTaskDescription('x'.repeat(20_000))).toBe(true)
    expect(isTaskDescription('x'.repeat(20_001))).toBe(false)
    expect(getTaskDueState('2026-07-16', '2026-07-17', false)).toBe('overdue')
    expect(getTaskDueState('2026-07-17', '2026-07-17', false)).toBe('due_today')
    expect(getTaskDueState('2026-07-17', '2026-07-17', true)).toBe('none')
  })

  it('maps collaboration levels without treating read-only access as writable', () => {
    expect(resolveTaskCapabilities({
      collaboration: 'full',
      activeScope: true,
      channelMember: true,
      createdByActor: false,
      assignedToActor: false,
    })).toMatchObject({ canView: true, canCreate: true, canEdit: true, canManage: false })
    expect(resolveTaskCapabilities({
      collaboration: 'scoped',
      activeScope: true,
      channelMember: true,
      createdByActor: false,
      assignedToActor: false,
    }).canEdit).toBe(false)
    expect(resolveTaskCapabilities({
      collaboration: 'read_only',
      activeScope: false,
      channelMember: true,
      createdByActor: true,
      assignedToActor: true,
    })).toMatchObject({ canView: true, canCreate: false, canEdit: false, canComment: false })
  })

  it('normalizes fingerprints and sorts source IDs for stable identity', () => {
    expect(taskSuggestionFingerprint({
      projectId: 'p1',
      groupId: 'g1',
      sourceIds: ['m2', 'm1'],
      title: ' Ship   release ',
    })).toBe(taskSuggestionFingerprint({
      projectId: 'p1',
      groupId: 'g1',
      sourceIds: ['m1', 'm2'],
      title: 'ship release',
    }))
  })
})
