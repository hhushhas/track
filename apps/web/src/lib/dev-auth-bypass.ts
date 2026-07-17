import { useEffect, useState } from 'react'
import {
  createDevAuthBypassSessionData,
  devAuthBypassStorageKey,
  shouldAllowDevAuthBypass,
} from '@track/shared'
import { authClient } from './auth-client'

const devAuthBypassChangedEvent = 'track-dev-auth-bypass-changed'
const devAuthBypassPassword = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_AUTH_BYPASS_PASSWORD
  : undefined
let memoryDevAuthBypassEnabled = false

export const isDevAuthBypassAllowed = Boolean(
  devAuthBypassPassword && shouldAllowDevAuthBypass({
    flag: import.meta.env.VITE_DEV_AUTH_BYPASS,
    isDev: import.meta.env.DEV,
  }),
)

function getStoredDevAuthBypassEnabled() {
  if (!isDevAuthBypassAllowed || typeof window === 'undefined') return false
  return window.localStorage.getItem(devAuthBypassStorageKey) === '1'
}

function notifyDevAuthBypassChanged() {
  window.dispatchEvent(new Event(devAuthBypassChangedEvent))
}

export async function enableDevAuthBypass() {
  if (!isDevAuthBypassAllowed || !devAuthBypassPassword || typeof window === 'undefined') {
    throw new Error('dev_auth_bypass_disabled')
  }

  const signIn = await authClient.signIn.email({
    email: 'developer@track.local',
    password: devAuthBypassPassword,
    callbackURL: '/workspace',
  })
  if (signIn.error) {
    const signUp = await authClient.signUp.email({
      email: 'developer@track.local',
      password: devAuthBypassPassword,
      name: 'Track Developer',
      callbackURL: '/workspace',
    })
    if (signUp.error) throw new Error('dev_auth_sign_in_failed')
  }

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
