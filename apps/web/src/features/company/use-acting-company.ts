import { useEffect, useState } from 'react'
import type { Id } from '../../../../../convex/_generated/dataModel'

const storageKey = 'track-acting-company-id'

export function useActingCompany(availableIds: Array<Id<'companies'>>) {
  const [actingCompanyId, setActingCompanyId] = useState<Id<'companies'> | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(storageKey) as Id<'companies'> | null
  })

  useEffect(() => {
    if (actingCompanyId && availableIds.includes(actingCompanyId)) return
    setActingCompanyId(availableIds[0] ?? null)
  }, [actingCompanyId, availableIds])

  useEffect(() => {
    if (!actingCompanyId) return
    window.localStorage.setItem(storageKey, actingCompanyId)
  }, [actingCompanyId])

  return { actingCompanyId, setActingCompanyId }
}
