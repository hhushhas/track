import { describe, expect, it } from 'vitest'

import { resolveWorkflowStateId } from './task-form-state'

const states = [
  { _id: 'todo', isDefault: true },
  { _id: 'progress' },
]

describe('conversation task destination state', () => {
  it('preserves a valid status selected by the user', () => {
    expect(resolveWorkflowStateId(states, 'progress')).toBe('progress')
  })

  it('uses the default when the current status is not on the board', () => {
    expect(resolveWorkflowStateId(states, 'other')).toBe('todo')
  })
})
