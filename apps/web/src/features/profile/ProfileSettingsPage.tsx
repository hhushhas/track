import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  KeyRound,
  Mail,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react'
import { toDataURL } from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import TrackLoader from '#/components/TrackLoader'
import { authClient } from '#/lib/auth-client'
import { useDevAuthBypass } from '#/lib/dev-auth-bypass'
import { getInitials } from '#/features/workspace/identity'

type ProfileSettingsPageProps = {
  mode: 'onboarding' | 'settings'
}

type AuthAccount = {
  id?: string
  providerId: string
}

type AuthClientWithAccountMethods = typeof authClient & {
  listAccounts: () => Promise<{ data?: AuthAccount[] | null; error?: { message?: string } | null }>
}

type AuthClientWithTwoFactorMethods = typeof authClient & {
  twoFactor: typeof authClient.twoFactor & {
    enable: (input: { issuer?: string; password?: string }) => Promise<{
      data?: { backupCodes: string[]; totpURI: string } | null
      error?: { message?: string } | null
    }>
    disable: (input: { password?: string }) => Promise<{ error?: { message?: string } | null }>
    generateBackupCodes: (input: { password?: string }) => Promise<{
      data?: { backupCodes: string[] } | null
      error?: { message?: string } | null
    }>
    verifyTotp: (input: { code: string; trustDevice?: boolean }) => Promise<{
      error?: { message?: string } | null
    }>
  }
}

const maxAvatarBytes = 2 * 1024 * 1024
const allowedAvatarTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function getTimezoneOptions() {
  const browserTimezone = getBrowserTimezone()
  const fallback = [
    browserTimezone,
    'UTC',
    'Asia/Karachi',
    'Asia/Dubai',
    'Europe/London',
    'America/New_York',
  ]

  const supportedValues = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : fallback

  return Array.from(new Set([browserTimezone, ...supportedValues, ...fallback])).sort()
}

function getLocalTimeLabel(timezone: string) {
  try {
    return new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date())
  } catch {
    return timezone
  }
}

function isProfileComplete(input: {
  displayName: string
  profileDesignation: string
  timezone: string
}) {
  return Boolean(input.displayName.trim() && input.profileDesignation.trim() && input.timezone.trim())
}

function getProviderLabel(providerId: string) {
  if (providerId === 'google') return 'Google'
  if (providerId === 'credential') return 'Email password'
  return providerId.replaceAll('_', ' ')
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message)
    if (message) return message
  }
  return fallback
}

function getSecurityMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback)
  if (message.includes('CONVEX') || message.includes('unauthenticated')) {
    return 'Track could not sync the security change. Refresh and try again from a normal signed-in session.'
  }
  return message
}

export function ProfileSettingsPage({ mode }: ProfileSettingsPageProps) {
  const session = authClient.useSession()
  const devAuthBypass = useDevAuthBypass()
  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser)
  const syncDevUser = useMutation(api.auth.syncDevUser)
  const updateProfile = useMutation(api.auth.updateProfile)
  const generateAvatarUploadUrl = useMutation(api.auth.generateAvatarUploadUrl)
  const setAvatar = useMutation(api.auth.setAvatar)
  const setTwoFactorEnabled = useMutation(api.auth.setTwoFactorEnabled)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null)
  const profileStatus = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip')
  const avatarUrl = useQuery(api.auth.getAvatarUrl, trackUserId ? { userId: trackUserId } : 'skip')

  const [displayName, setDisplayName] = useState('')
  const [designation, setDesignation] = useState('')
  const [bio, setBio] = useState('')
  const [timezone, setTimezone] = useState(getBrowserTimezone)
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState('')
  const [busyProfile, setBusyProfile] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [securityMessage, setSecurityMessage] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [setupQrUrl, setSetupQrUrl] = useState('')
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([])
  const [backupCodesVisible, setBackupCodesVisible] = useState(false)
  const [busySecurity, setBusySecurity] = useState(false)
  const [activePanel, setActivePanel] = useState<'profile' | 'security' | 'methods'>('profile')
  const [timezoneOpen, setTimezoneOpen] = useState(false)
  const [timezoneSearch, setTimezoneSearch] = useState('')

  const timezoneOptions = useMemo(getTimezoneOptions, [])
  const filteredTimezoneOptions = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase()
    const matches = query
      ? timezoneOptions.filter((option) => option.toLowerCase().includes(query))
      : timezoneOptions
    return matches.slice(0, 80)
  }, [timezoneOptions, timezoneSearch])
  const user = profileStatus?.user ?? null
  const profileComplete = profileStatus?.complete ?? false
  const canSaveProfile = isProfileComplete({ displayName, profileDesignation: designation, timezone })
  const hasCredentialAccount = accounts.some((account) => account.providerId === 'credential')
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled)
  const visibleAvatarUrl = avatarPreview ?? avatarUrl ?? undefined
  const canManageTwoFactor = Boolean(session.data)

  useEffect(() => {
    if (session.isPending && !devAuthBypass.enabled) return
    if (!session.data && !devAuthBypass.enabled) {
      window.location.href = '/sign-in'
      return
    }

    const sync = devAuthBypass.enabled ? syncDevUser : ensureCurrentUser
    void sync({}).then((id) => {
      if (id) setTrackUserId(id)
    })
  }, [devAuthBypass.enabled, ensureCurrentUser, session.data, session.isPending, syncDevUser])

  useEffect(() => {
    if (!user || hydratedUserId === user._id) return
    setDisplayName(user.displayName ?? '')
    setDesignation(user.profileDesignation ?? '')
    setBio(user.profileBio ?? '')
    setTimezone(user.timezone ?? getBrowserTimezone())
    setHydratedUserId(user._id)
  }, [hydratedUserId, user])

  useEffect(() => {
    if (!session.data) return
    const client = authClient as AuthClientWithAccountMethods
    void client.listAccounts().then((result) => {
      if (!result.error && result.data) setAccounts(result.data)
    })
  }, [session.data])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId) return
    if (!canSaveProfile) {
      setProfileMessage('Display name, designation, and timezone are required.')
      return
    }

    setBusyProfile(true)
    setProfileMessage('')
    try {
      await updateProfile({
        userId: trackUserId,
        displayName,
        profileDesignation: designation,
        profileBio: bio || undefined,
        timezone,
      })
      setProfileMessage('Profile saved.')
      if (mode === 'onboarding') {
        const next = new URLSearchParams(window.location.search).get('next') || '/workspace'
        window.location.href = next.startsWith('/') ? next : '/workspace'
      }
    } catch (error) {
      setProfileMessage(getErrorMessage(error, 'Could not save profile.'))
    } finally {
      setBusyProfile(false)
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file || !trackUserId) return
    setAvatarMessage('')

    if (!allowedAvatarTypes.has(file.type)) {
      setAvatarMessage('Use PNG, JPEG, or WebP.')
      return
    }
    if (file.size > maxAvatarBytes) {
      setAvatarMessage('Avatar must be 2MB or smaller.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    try {
      const uploadUrl = await generateAvatarUploadUrl({ userId: trackUserId })
      const response = await fetch(uploadUrl, {
        body: file,
        headers: { 'Content-Type': file.type },
        method: 'POST',
      })
      if (!response.ok) throw new Error('avatar_upload_failed')
      const { storageId } = await response.json() as { storageId: Id<'_storage'> }
      await setAvatar({ userId: trackUserId, avatarStorageId: storageId })
      setAvatarMessage('Avatar saved.')
    } catch (error) {
      setAvatarMessage(getErrorMessage(error, 'Could not upload avatar.'))
      setAvatarPreview(null)
    }
  }

  async function startTwoFactorSetup() {
    setBusySecurity(true)
    setSecurityMessage('')
    try {
      const client = authClient as AuthClientWithTwoFactorMethods
      const result = await client.twoFactor.enable({
        issuer: 'Track',
        password: accountPassword || undefined,
      })
      if (result.error || !result.data) {
        setSecurityMessage(result.error?.message ?? 'Could not start two-factor setup.')
        return
      }
      const qrDataUrl = await toDataURL(result.data.totpURI, {
        margin: 1,
        scale: 5,
      })
      setSetupQrUrl(qrDataUrl)
      setSetupBackupCodes(result.data.backupCodes)
      setBackupCodesVisible(false)
      setSecurityMessage('Scan the code, then enter one authenticator code to finish setup.')
    } catch (error) {
      setSecurityMessage(getSecurityMessage(error, 'Could not start two-factor setup.'))
    } finally {
      setBusySecurity(false)
    }
  }

  async function verifyTwoFactorSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId) return
    setBusySecurity(true)
    setSecurityMessage('')
    try {
      const client = authClient as AuthClientWithTwoFactorMethods
      const result = await client.twoFactor.verifyTotp({ code: setupCode })
      if (result.error) {
        setSecurityMessage(result.error.message ?? 'Invalid authenticator code.')
        return
      }
      await setTwoFactorEnabled({ userId: trackUserId, enabled: true })
      setSetupCode('')
      setSetupQrUrl('')
      setSecurityMessage('Two-factor authentication is on.')
    } catch (error) {
      setSecurityMessage(getSecurityMessage(error, 'Could not verify two-factor setup.'))
    } finally {
      setBusySecurity(false)
    }
  }

  async function regenerateBackupCodes() {
    setBusySecurity(true)
    setSecurityMessage('')
    try {
      const client = authClient as AuthClientWithTwoFactorMethods
      const result = await client.twoFactor.generateBackupCodes({
        password: accountPassword || undefined,
      })
      if (result.error || !result.data) {
        setSecurityMessage(result.error?.message ?? 'Could not generate backup codes.')
        return
      }
      setSetupBackupCodes(result.data.backupCodes)
      setBackupCodesVisible(true)
      setSecurityMessage('New backup codes generated. Store them somewhere safe.')
    } catch (error) {
      setSecurityMessage(getSecurityMessage(error, 'Could not generate backup codes.'))
    } finally {
      setBusySecurity(false)
    }
  }

  async function disableTwoFactor() {
    if (!trackUserId) return
    setBusySecurity(true)
    setSecurityMessage('')
    try {
      const client = authClient as AuthClientWithTwoFactorMethods
      const result = await client.twoFactor.disable({ password: accountPassword || undefined })
      if (result.error) {
        setSecurityMessage(result.error.message ?? 'Could not disable two-factor authentication.')
        return
      }
      await setTwoFactorEnabled({ userId: trackUserId, enabled: false })
      setSecurityMessage('Two-factor authentication is off.')
    } catch (error) {
      setSecurityMessage(getSecurityMessage(error, 'Could not disable two-factor authentication.'))
    } finally {
      setBusySecurity(false)
    }
  }

  if ((session.isPending && !devAuthBypass.enabled) || !trackUserId || profileStatus === undefined) {
    return <TrackLoader label="Loading profile" />
  }

  return (
    <main className="track-profile-page">
      <section className="track-profile-shell">
        <aside className="track-profile-sidebar" aria-label="Profile settings sections">
          {mode === 'settings' ? (
            <a className="track-profile-back-link" href="/workspace">
              <ArrowLeft size={14} />
              Back to workspace
            </a>
          ) : null}
          <div>
            <p className="mono-label m-0">Track</p>
            <h1>{mode === 'onboarding' ? 'Complete your profile' : 'Profile Settings'}</h1>
            <p>
              {mode === 'onboarding'
                ? 'Display name, designation, and timezone are required before entering the workspace.'
                : 'Manage your public teammate profile, login methods, and security.'}
            </p>
          </div>
          {mode === 'settings' ? (
            <nav className="track-profile-tabs">
              <Button className={activePanel === 'profile' ? 'active' : ''} onClick={() => setActivePanel('profile')} type="button">
                <UserRound size={15} /> Profile
              </Button>
              <Button className={activePanel === 'security' ? 'active' : ''} onClick={() => setActivePanel('security')} type="button">
                <ShieldCheck size={15} /> Security
              </Button>
              <Button className={activePanel === 'methods' ? 'active' : ''} onClick={() => setActivePanel('methods')} type="button">
                <KeyRound size={15} /> Login methods
              </Button>
            </nav>
          ) : null}
        </aside>

        <div className="track-profile-content">
          {(mode === 'onboarding' || activePanel === 'profile') ? (
            <section className="track-profile-section">
              <div className="track-profile-section-header">
                <div>
                  <p className="mono-label m-0">Profile</p>
                  <h2>Teammate card</h2>
                </div>
                {profileComplete ? <span className="track-profile-status"><CheckCircle2 size={14} /> Complete</span> : null}
              </div>

              <div className="track-profile-avatar-row">
                <Avatar className="track-profile-avatar">
                  <AvatarImage src={visibleAvatarUrl} />
                  <AvatarFallback>{getInitials(displayName || user?.email || 'Track User')}</AvatarFallback>
                </Avatar>
                <label className="track-profile-avatar-upload">
                  <Camera size={15} />
                  <span>Upload avatar</span>
                  <input accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event)} type="file" />
                </label>
                {avatarMessage ? <p>{avatarMessage}</p> : null}
              </div>

              <form className="track-profile-form" onSubmit={(event) => void saveProfile(event)}>
                <label>
                  <span>Display name</span>
                  <Input value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} />
                </label>
                <label>
                  <span>Designation</span>
                  <Input
                    maxLength={60}
                    value={designation}
                    onChange={(event) => setDesignation(event.currentTarget.value)}
                  />
                  <small>{designation.length}/60</small>
                </label>
                <label>
                  <span>Timezone</span>
                  <div className="track-timezone-picker">
                    <button
                      aria-expanded={timezoneOpen}
                      className="track-timezone-trigger"
                      onClick={() => {
                        setTimezoneOpen((open) => !open)
                        setTimezoneSearch('')
                      }}
                      type="button"
                    >
                      <span>{timezone}</span>
                      <ChevronDown size={15} />
                    </button>
                    {timezoneOpen ? (
                      <div className="track-timezone-menu">
                        <Input
                          autoFocus
                          onChange={(event) => setTimezoneSearch(event.currentTarget.value)}
                          placeholder="Search timezone"
                          value={timezoneSearch}
                        />
                        <div className="track-timezone-options">
                          {filteredTimezoneOptions.map((option) => (
                            <button
                              className={option === timezone ? 'active' : ''}
                              key={option}
                              onClick={() => {
                                setTimezone(option)
                                setTimezoneOpen(false)
                                setTimezoneSearch('')
                              }}
                              type="button"
                            >
                              <span>{option}</span>
                              <small>{getLocalTimeLabel(option)}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <small>{getLocalTimeLabel(timezone)}</small>
                </label>
                <label>
                  <span>Bio</span>
                  <Textarea
                    maxLength={180}
                    rows={4}
                    value={bio}
                    onChange={(event) => setBio(event.currentTarget.value)}
                  />
                  <small>{bio.length}/180</small>
                </label>
                <div className="track-profile-actions">
                  <button className="track-button track-button-primary" disabled={busyProfile || !canSaveProfile} type="submit">
                    {mode === 'onboarding' ? 'Save and enter Track' : 'Save changes'}
                  </button>
                  {profileMessage ? <p>{profileMessage}</p> : null}
                </div>
              </form>
            </section>
          ) : null}

          {mode === 'settings' && activePanel === 'security' ? (
            <section className="track-profile-section">
              <div className="track-profile-section-header">
                <div>
                  <p className="mono-label m-0">Security</p>
                  <h2>Two-factor authentication</h2>
                </div>
                <span className={twoFactorEnabled ? 'track-profile-status' : 'track-profile-status muted'}>
                  <ShieldCheck size={14} /> {twoFactorEnabled ? 'On' : 'Off'}
                </span>
              </div>
              <p className="track-profile-muted">
                Normal sign-in can use one factor. Destructive actions require a fresh step-up and stay trusted for 10 minutes. Trusted devices last 30 days.
              </p>

              <div className="track-security-summary">
                <div>
                  <span><Smartphone size={16} /></span>
                  <strong>Authenticator app</strong>
                  <small>{twoFactorEnabled ? 'Required for protected actions' : 'Not configured yet'}</small>
                </div>
                <div>
                  <span><KeyRound size={16} /></span>
                  <strong>Backup codes</strong>
                  <small>{setupBackupCodes.length ? 'Available to view' : 'Generate after setup'}</small>
                </div>
                <div>
                  <span><Clock3 size={16} /></span>
                  <strong>Trusted device</strong>
                  <small>30-day remember window</small>
                </div>
              </div>

              {!canManageTwoFactor ? (
                <div className="track-security-note">
                  Sign in with Google or email/password to manage two-factor authentication from this browser session.
                </div>
              ) : null}

              {hasCredentialAccount ? (
                <label className="track-profile-password">
                  <span>Account password</span>
                  <Input
                    autoComplete="current-password"
                    onChange={(event) => setAccountPassword(event.currentTarget.value)}
                    placeholder="Required for email/password accounts"
                    type="password"
                    value={accountPassword}
                  />
                </label>
              ) : null}

              {!twoFactorEnabled && canManageTwoFactor ? (
                <div className="track-profile-security-box">
                  {!setupQrUrl ? (
                    <Button className="track-button track-button-primary" disabled={busySecurity} onClick={() => void startTwoFactorSetup()} type="button">
                      <QrCode size={15} /> Set up authenticator app
                    </Button>
                  ) : (
                    <>
                      <img alt="Authenticator QR code" className="track-profile-qr" src={setupQrUrl} />
                      <form className="track-profile-inline-form" onSubmit={(event) => void verifyTwoFactorSetup(event)}>
                        <Input
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          onChange={(event) => setSetupCode(event.currentTarget.value)}
                          placeholder="123456"
                          value={setupCode}
                        />
                        <button className="track-button track-button-primary" disabled={busySecurity} type="submit">
                          Verify code
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : twoFactorEnabled && canManageTwoFactor ? (
                <div className="track-profile-security-box">
                  <Button className="track-button" disabled={busySecurity} onClick={() => void regenerateBackupCodes()} type="button">
                    Generate backup codes
                  </Button>
                  <Button className="track-button track-button-danger" disabled={busySecurity} onClick={() => void disableTwoFactor()} type="button">
                    Turn off 2FA
                  </Button>
                </div>
              ) : null}

              {setupBackupCodes.length ? (
                <div className="track-profile-backup-codes">
                  <Button className="track-button" onClick={() => setBackupCodesVisible((visible) => !visible)} type="button">
                    {backupCodesVisible ? 'Hide backup codes' : 'Show backup codes'}
                  </Button>
                  {backupCodesVisible ? (
                    <div>
                      {setupBackupCodes.map((code) => <code key={code}>{code}</code>)}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {securityMessage ? <p className="track-profile-message">{securityMessage}</p> : null}
            </section>
          ) : null}

          {mode === 'settings' && activePanel === 'methods' ? (
            <section className="track-profile-section">
              <div className="track-profile-section-header">
                <div>
                  <p className="mono-label m-0">Account</p>
                  <h2>Login methods</h2>
                </div>
              </div>
              <div className="track-profile-method-list">
                {accounts.length ? accounts.map((account) => (
                  <div key={`${account.providerId}-${account.id ?? account.providerId}`}>
                    <span className="track-profile-method-identity">
                      <span className="track-profile-method-icon">
                        {account.providerId === 'google'
                          ? <img alt="" src="/google-g.svg" />
                          : account.providerId === 'credential'
                            ? <Mail size={17} />
                            : <KeyRound size={17} />}
                      </span>
                      <strong>{getProviderLabel(account.providerId)}</strong>
                    </span>
                    <span>Connected</span>
                  </div>
                )) : (
                  <div>
                    <span className="track-profile-method-identity">
                      <span className="track-profile-method-icon"><Mail size={17} /></span>
                      <strong>{user?.email ?? 'Current account'}</strong>
                    </span>
                    <span>Connected</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  )
}
