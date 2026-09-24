import { describe, expect, it } from 'vitest'

import { taskMoveErrorMessage } from './TaskBoard'

describe('task board move feedback', () => {
  it('explains scoped task permissions', () => {
    expect(taskMoveErrorMessage(new Error('task_edit_forbidden'))).toContain('assigned to you or created by you')
  })

  it('explains conflicts and invalid destinations', () => {
    expect(taskMoveErrorMessage(new Error('task_conflict:4'))).toContain('changed elsewhere')
    expect(taskMoveErrorMessage(new Error('task_destination_invalid'))).toContain('no longer available')
  })

  it('keeps unknown server failures safe', () => {
    expect(taskMoveErrorMessage(new Error('internal_database_detail'))).toBe(
      "The move couldn't be saved. The card returned to its current position.",
    )
  })
})
