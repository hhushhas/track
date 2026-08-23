import { describe, expect, it } from 'vitest'

import { parseMentions } from './domain'

describe('Track shared domain contracts', () => {
  it('parses unique, case-insensitive mentions at text boundaries', () => {
    expect(parseMentions('@Track, ask @Hasan and @track,')).toEqual(['track', 'hasan'])
  })
})
