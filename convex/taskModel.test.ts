import { describe, expect, it } from 'vitest'

import { parseTaskModelCandidates } from './lib/taskModel'

describe('task model adapter', () => {
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
