import { describe, expect, it } from 'vitest'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { taskError } from './TaskCreateDialog'
import { groupTaskViewsByState, taskIdentity, type TaskView } from './task-types'

describe('task web presenters', () => {
  it('keeps represented Company identity exact and legacy operation standalone', () => {
    expect(taskIdentity({})).toEqual({})
    expect(taskIdentity({ actingCompanyId: 'company', projectMemberId: 'membership' })).toEqual({
      actingCompanyId: 'company',
      projectMemberId: 'membership',
    })
  })

  it('uses optimistic status only until the authoritative task update arrives', () => {
    const todo = { _id: 'todo' } as Doc<'taskWorkflowStates'>
    const done = { _id: 'done' } as Doc<'taskWorkflowStates'>
    const task = {
      task: { _id: 'task', workflowStateId: todo._id, rank: '00000001' },
    } as TaskView
    const grouped = groupTaskViewsByState([todo, done], [task], { task: done._id })
    expect(grouped.get(todo._id)).toEqual([])
    expect(grouped.get(done._id)?.[0].task._id).toBe('task' as Id<'tasks'>)
  })

  it('maps conflicts, destination changes, and access loss to safe recovery copy', () => {
    expect(taskError(new Error('task_conflict:3'))).toContain('changed while you were editing')
    expect(taskError(new Error('task_destination_invalid'))).toContain('no longer available')
    expect(taskError(new Error('task_access_changed'))).toBe('Task unavailable or access changed.')
  })
})
