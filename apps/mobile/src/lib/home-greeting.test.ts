import { describe, expect, it } from 'vitest'

import { getHomeGreeting } from './home-greeting'

function localHour(hour: number) {
  return new Date(2026, 0, 1, hour, 0, 0, 0)
}

describe('getHomeGreeting', () => {
  it.each([
    [0, 'Good night'],
    [4, 'Good night'],
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [16, 'Good afternoon'],
    [17, 'Good evening'],
    [20, 'Good evening'],
    [21, 'Good night'],
    [23, 'Good night'],
  ])('returns the correct greeting at %s:00', (hour, greeting) => {
    expect(getHomeGreeting(localHour(hour))).toBe(greeting)
  })
})
