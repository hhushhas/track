import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('assistant runtime split', () => {
  it('keeps the public assistant action free of heavy AI imports', async () => {
    const assistantSource = await readFile(new URL('./assistant.ts', import.meta.url), 'utf8')
    const nodeSource = await readFile(new URL('./assistantNode.ts', import.meta.url), 'utf8')

    expect(assistantSource).not.toContain('./lib/ai')
    expect(assistantSource).not.toContain("from 'ai'")
    expect(nodeSource.trimStart()).toMatch(/^"use node";/)
    expect(nodeSource).toContain('./lib/ai')
  })
})
