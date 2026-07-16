import { describe, expect, it } from 'vitest'

import {
  createDeterministicFakeTaskModel,
  parseTaskModelCandidates,
  taskDetectionPrompt,
} from './lib/taskModel'

describe('task model adapter', () => {
  it('validates structured candidates against the exact Channel source window', () => {
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

  it('provides deterministic success and provider-failure coverage without network calls', async () => {
    const success = createDeterministicFakeTaskModel({ model: 'fake-v1', candidates: [] })
    await expect(success.detect([])).resolves.toEqual({ model: 'fake-v1', candidates: [] })
    const failure = createDeterministicFakeTaskModel(new Error('provider_unavailable'))
    await expect(failure.detect([])).rejects.toThrow('provider_unavailable')
  })

  it('keeps the prompt bounded to supplied Channel messages', () => {
    const prompt = taskDetectionPrompt([{ id: 'm1', author: 'Hasan', body: 'Please ship it.', sequence: 4 }])
    expect(prompt).toContain('[m1] Hasan: Please ship it.')
    expect(prompt).toContain('this one Channel')
  })
})
