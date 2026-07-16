import { describe, expect, it } from 'vitest'

import {
  canTransitionTaskSuggestion,
  getTaskDueState,
  isTaskDescription,
  isTaskDueDate,
  isTaskTitle,
  isTerminalTaskState,
  resolveTaskCapabilities,
  taskSuggestionFingerprint,
} from './tasks'

describe('task domain contracts', () => {
  it('classifies terminal workflow categories and local due dates', () => {
    expect(isTerminalTaskState('completed')).toBe(true)
    expect(isTerminalTaskState('started')).toBe(false)
    expect(isTaskDueDate('2026-02-29')).toBe(false)
    expect(isTaskDueDate('2028-02-29')).toBe(true)
    expect(getTaskDueState('2026-07-16', '2026-07-17', false)).toBe('overdue')
    expect(getTaskDueState('2026-07-17', '2026-07-17', false)).toBe('due_today')
    expect(getTaskDueState('2026-07-17', '2026-07-17', true)).toBe('none')
  })

  it('validates bounded task fields', () => {
    expect(isTaskTitle('  Ship the task release  ')).toBe(true)
    expect(isTaskTitle('   ')).toBe(false)
    expect(isTaskTitle('x'.repeat(181))).toBe(false)
    expect(isTaskDescription('x'.repeat(20_000))).toBe(true)
    expect(isTaskDescription('x'.repeat(20_001))).toBe(false)
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

  it('allows exactly one terminal suggestion decision and stable source fingerprints', () => {
    expect(canTransitionTaskSuggestion('pending', 'accepted')).toBe(true)
    expect(canTransitionTaskSuggestion('accepted', 'dismissed')).toBe(false)
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
