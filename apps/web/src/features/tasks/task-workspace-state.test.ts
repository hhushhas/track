import { describe, expect, it } from 'vitest'

import { boardIdForTaskView, resolveWorkflowStateId } from './task-workspace-state'

describe('task workspace query state', () => {
  it('keeps Board scoped while List and Calendar remain project-wide', () => {
    expect(boardIdForTaskView('board', 'board-a')).toBe('board-a')
    expect(boardIdForTaskView('list', 'board-a')).toBeUndefined()
    expect(boardIdForTaskView('calendar', 'board-a')).toBeUndefined()
  })

  it('resolves a requested workflow state from any accessible board', () => {
    const boards = [
      { states: [{ _id: 'state-a' }] },
      { states: [{ _id: 'state-b' }] },
    ]

    expect(resolveWorkflowStateId(boards, 'state-b')).toBe('state-b')
    expect(resolveWorkflowStateId(boards, 'missing')).toBeUndefined()
  })
})
