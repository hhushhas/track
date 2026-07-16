import { act, renderHook } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Id } from '../../../../../convex/_generated/dataModel'
import { useActingCompany } from './use-acting-company'

describe('web Acting Company selection', () => {
  const first = 'company-first' as Id<'companies'>
  const second = 'company-second' as Id<'companies'>

  beforeAll(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  beforeEach(() => window.localStorage.clear())

  it('selects an available Company and persists an explicit switch', () => {
    const { result } = renderHook(() => useActingCompany([first, second]))
    expect(result.current.actingCompanyId).toBe(first)

    act(() => result.current.setActingCompanyId(second))
    expect(result.current.actingCompanyId).toBe(second)
    expect(window.localStorage.getItem('track-acting-company-id')).toBe(second)
  })

  it('drops a stale represented Company instead of leaking another context', () => {
    window.localStorage.setItem('track-acting-company-id', second)
    const { result, rerender } = renderHook(({ available }) => useActingCompany(available), {
      initialProps: { available: [first, second] },
    })
    expect(result.current.actingCompanyId).toBe(second)

    rerender({ available: [first] })
    expect(result.current.actingCompanyId).toBe(first)
  })
})
