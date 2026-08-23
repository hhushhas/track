import { describe, expect, it } from 'vitest'

import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { groupTaskViewsByState, type TaskView } from './task-types'

describe('task web presenters', () => {
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
})
