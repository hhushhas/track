import { describe, expect, it } from 'vitest'

import { companyGreetingForHour } from './company-greeting'

describe('companyGreetingForHour', () => {
  it('uses morning before noon', () => {
    expect(companyGreetingForHour(0)).toBe('Good morning')
    expect(companyGreetingForHour(11)).toBe('Good morning')
  })

  it('uses afternoon from noon until five', () => {
    expect(companyGreetingForHour(12)).toBe('Good afternoon')
    expect(companyGreetingForHour(16)).toBe('Good afternoon')
  })

  it('uses evening after five', () => {
    expect(companyGreetingForHour(17)).toBe('Good evening')
    expect(companyGreetingForHour(23)).toBe('Good evening')
  })
})
