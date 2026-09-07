import { describe, expect, it } from 'vitest'

import { parseTaskModelCandidates } from './lib/taskModel'

describe('task model adapter', () => {
  it.each(['null', '[]', '{}', '{"candidates":null}', '{"candidates":{}}', '{'])('rejects a malformed model envelope: %s', (raw) => {
    expect(() => parseTaskModelCandidates(raw, new Set(['m1']))).toThrow('task_model_output_invalid')
  })

  it('ignores malformed candidates without losing another grounded candidate', () => {
    const candidate = {
      title: 'Review the change',
      sourceMessageIds: ['m1'],
      confidence: 0.9,
      groundingReason: 'An explicit request in m1.',
    }
    const candidates = parseTaskModelCandidates(JSON.stringify({ candidates: [
      null,
      'not a task',
      { ...candidate, sourceMessageIds: ['m1', 12] },
      { ...candidate, sourceMessageIds: ['m1', 'out-of-scope'] },
      { ...candidate, confidence: 'certain' },
      { ...candidate, priority: 'critical', dueDate: '2026-02-30' },
    ] }), new Set(['m1']))

    expect(candidates).toEqual([{ ...candidate, description: undefined, assigneeProjectMemberId: undefined, priority: undefined, dueDate: undefined }])
  })

  it('accepts only candidates grounded in the exact Channel source window', () => {
    const candidates = parseTaskModelCandidates(JSON.stringify({ candidates: [
      {
        title: 'Ship the release',
        description: 'Run the complete gate first.',
        priority: 'high',
        assigneeProjectMemberId: 'member-1',
        dueDate: '2026-07-18',
        sourceMessageIds: ['m1'],
        confidence: 0.92,
        groundingReason: 'The message explicitly asks for shipment.',
      },
      {
        title: 'Cross-scope candidate',
        sourceMessageIds: ['other-channel'],
        confidence: 0.99,
        groundingReason: 'Invalid source.',
      },
    ] }), new Set(['m1']))
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ title: 'Ship the release', priority: 'high', assigneeProjectMemberId: 'member-1' })
  })
})
