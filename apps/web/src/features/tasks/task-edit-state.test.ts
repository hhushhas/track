import { describe, expect, it } from 'vitest'

import {
  reconcileTaskDraft,
  taskDraftDirtyFields,
  type TaskDraft,
} from './task-edit-state'

const serverDraft: TaskDraft = {
  assigneeId: '',
  description: 'Server description',
  dueDate: '',
  priority: 'none',
  stateId: '',
  title: 'Server title',
}

describe('task draft reconciliation', () => {
  it('retains a dirty field when a realtime comment/detail refresh arrives', () => {
    const localDraft = { ...serverDraft, title: 'My unsaved title' }
    const result = reconcileTaskDraft({
      baseline: serverDraft,
      draft: localDraft,
      nextServer: serverDraft,
      previousServer: serverDraft,
    })

    expect(result.draft.title).toBe('My unsaved title')
    expect(result.conflictFields).toEqual([])
    expect(result.remoteChangedFields).toEqual([])
  })

  it('reports an overlapping server edit without discarding the local draft', () => {
    const localDraft = { ...serverDraft, title: 'My unsaved title' }
    const nextServer = { ...serverDraft, title: 'Remote title' }
    const result = reconcileTaskDraft({
      baseline: serverDraft,
      draft: localDraft,
      nextServer,
      previousServer: serverDraft,
    })

    expect(result.draft.title).toBe('My unsaved title')
    expect(result.conflictFields).toEqual(['title'])
    expect(taskDraftDirtyFields(result.draft, result.baseline)).toEqual(['title'])
  })

  it('merges a remote edit to a different field while preserving local work', () => {
    const localDraft = { ...serverDraft, title: 'My unsaved title' }
    const nextServer = { ...serverDraft, description: 'Remote description' }
    const result = reconcileTaskDraft({
      baseline: serverDraft,
      draft: localDraft,
      nextServer,
      previousServer: serverDraft,
    })

    expect(result.draft).toEqual({
      ...localDraft,
      description: 'Remote description',
    })
    expect(result.baseline.description).toBe('Remote description')
    expect(result.conflictFields).toEqual([])
  })
})
