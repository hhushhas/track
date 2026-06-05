import { describe, expect, it } from 'vitest'

import { FakeMemoryBoxAdapter } from './box'

describe('FakeMemoryBoxAdapter', () => {
  it('stores files and simulates exec without Upstash credentials', async () => {
    const adapter = new FakeMemoryBoxAdapter()
    const { boxId } = await adapter.create({
      name: 'test',
      networkPolicy: { mode: 'allow-all' },
      runtime: 'node',
      size: 'small',
    })

    await adapter.ensureDirectories(boxId, ['scratch', 'scratch/groups'])
    await adapter.writeFile(boxId, 'context.md', '# Project Context')

    expect(await adapter.readFile(boxId, 'context.md')).toBe('# Project Context')
    await expect(adapter.exec(boxId, { command: 'ls', cwd: 'scratch/runs/run_1/view' })).resolves.toMatchObject({
      exitCode: 0,
      status: 'completed',
    })
  })

  it('marks deleted boxes unavailable', async () => {
    const adapter = new FakeMemoryBoxAdapter()
    const { boxId } = await adapter.create({
      name: 'test',
      networkPolicy: { mode: 'allow-all' },
      runtime: 'node',
      size: 'small',
    })

    await adapter.delete(boxId)
    await expect(adapter.readFile(boxId, 'context.md')).rejects.toThrow('box_not_found')
  })
})
