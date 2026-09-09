import { useCallback, useEffect, useState } from 'react'
import type { Id } from '../../../../../convex/_generated/dataModel'

const storageKey = 'track-acting-company-id'

export function getStoredActingCompanyId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(storageKey) as Id<'companies'> | null
}

export function useActingCompany(availableIds: Array<Id<'companies'>>) {
  const [actingCompanyId, setActingCompanyIdState] = useState<Id<'companies'> | null>(
    getStoredActingCompanyId,
  )

  const setActingCompanyId = useCallback((companyId: Id<'companies'> | null) => {
    setActingCompanyIdState(companyId)
    if (typeof window === 'undefined') return
    if (companyId) window.localStorage.setItem(storageKey, companyId)
    else window.localStorage.removeItem(storageKey)
  }, [])

  useEffect(() => {
    if (actingCompanyId && availableIds.includes(actingCompanyId)) return
    setActingCompanyId(availableIds[0] ?? null)
  }, [actingCompanyId, availableIds, setActingCompanyId])

  return { actingCompanyId, setActingCompanyId }
}
