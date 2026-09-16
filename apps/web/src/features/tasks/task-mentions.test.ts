import { describe, expect, it } from 'vitest'

import { commentContainsMention, mentionQueryAtCursor, mentionTokenForCandidate } from './task-mentions'

describe('task comment mentions', () => {
  it('keeps selected mentions only while the visible tag remains', () => {
    expect(commentContainsMention('Please ask @Olivia Carter today.', 'Olivia Carter')).toBe(true)
    expect(commentContainsMention('Please ask Olivia Carter today.', 'Olivia Carter')).toBe(false)
    expect(commentContainsMention('Please ask @Olivia Carterton.', 'Olivia Carter')).toBe(false)
  })

  it('supports non-Latin display names', () => {
    expect(commentContainsMention('راجع @زهرة أحمد غدًا', 'زهرة أحمد')).toBe(true)
    expect(commentContainsMention('Обсуди с @Анна Иванова.', 'Анна Иванова')).toBe(true)
    expect(mentionQueryAtCursor('راجع @زهر', 9)).toEqual({ query: 'زهر', start: 5 })
  })

  it('creates stable, unique tokens for duplicate display names', () => {
    const candidates = [
      { companyName: 'Acme', displayName: 'Alex Smith', memberId: 'member-001' },
      { companyName: 'Orbit', displayName: 'Alex Smith', memberId: 'member-002' },
      { companyName: 'Acme', displayName: 'Taylor Jones', memberId: 'member-003' },
      { companyName: 'Acme', displayName: 'Taylor Jones', memberId: 'member-004' },
    ]
    expect(mentionTokenForCandidate(candidates[0], candidates)).toBe('Alex Smith · Acme')
    expect(mentionTokenForCandidate(candidates[1], candidates)).toBe('Alex Smith · Orbit')
    expect(mentionTokenForCandidate(candidates[2], candidates)).toBe('Taylor Jones · Acme · er-003')
    expect(mentionTokenForCandidate(candidates[3], candidates)).toBe('Taylor Jones · Acme · er-004')
  })
})
