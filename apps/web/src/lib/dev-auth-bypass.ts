import { useEffect, useState } from 'react'
import {
  createDevAuthBypassSessionData,
  devAuthBypassStorageKey,
  shouldAllowDevAuthBypass,
} from '@track/shared'

const devAuthBypassChangedEvent = 'track-dev-auth-bypass-changed'
let memoryDevAuthBypassEnabled = false

export const isDevAuthBypassAllowed = shouldAllowDevAuthBypass({
  flag: import.meta.env.VITE_DEV_AUTH_BYPASS,
  isDev: import.meta.env.DEV,
})

function getStoredDevAuthBypassEnabled() {
  if (!isDevAuthBypassAllowed || typeof window === 'undefined') return false
  return window.localStorage.getItem(devAuthBypassStorageKey) === '1'
}

function notifyDevAuthBypassChanged() {
  window.dispatchEvent(new Event(devAuthBypassChangedEvent))
}

export function enableDevAuthBypass() {
  if (!isDevAuthBypassAllowed || typeof window === 'undefined') return
  memoryDevAuthBypassEnabled = true
  window.localStorage.setItem(devAuthBypassStorageKey, '1')
  notifyDevAuthBypassChanged()
}

export function disableDevAuthBypass() {
  if (typeof window === 'undefined') return
  memoryDevAuthBypassEnabled = false
  window.localStorage.removeItem(devAuthBypassStorageKey)
  notifyDevAuthBypassChanged()
}

export function useDevAuthBypass() {
  const [enabled, setEnabled] = useState(memoryDevAuthBypassEnabled)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const syncEnabled = () => {
      memoryDevAuthBypassEnabled = getStoredDevAuthBypassEnabled()
      setEnabled(memoryDevAuthBypassEnabled)
    }
    syncEnabled()
    setHydrated(true)
    window.addEventListener('storage', syncEnabled)
    window.addEventListener(devAuthBypassChangedEvent, syncEnabled)
    return () => {
      window.removeEventListener('storage', syncEnabled)
      window.removeEventListener(devAuthBypassChangedEvent, syncEnabled)
    }
  }, [])

  return {
    allowed: isDevAuthBypassAllowed,
    enabled,
    hydrated,
    sessionData: enabled ? createDevAuthBypassSessionData() : null,
  }
}
