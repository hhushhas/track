import { describe, expect, it } from 'vitest'

import { indexTaskLinks } from './task-link-context'

describe('indexTaskLinks', () => {
  it('indexes each batched source without dropping empty link results', () => {
    const links = indexTaskLinks([
      { sourceId: 'message-1', tasks: [{ publicKey: 'TRK-1' }] },
      { sourceId: 'message-2', tasks: [] },
    ], (row) => row.sourceId)

    expect(links.get('message-1')).toEqual([{ publicKey: 'TRK-1' }])
    expect(links.get('message-2')).toEqual([])
    expect(links.has('missing-message')).toBe(false)
  })
})
