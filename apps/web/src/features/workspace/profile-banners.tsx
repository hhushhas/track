import { useEffect, useState } from 'react'

export const profileBannerStyles = [
  { id: 'silk', label: 'Silk Weave' },
  { id: 'velvet-flow', label: 'Velvet Flow' },
  { id: 'midnight-veil', label: 'Midnight Veil' },
  { id: 'luminous-beams', label: 'Luminous Beams' },
  { id: 'aurora-wash', label: 'Aurora Wash' },
  { id: 'soft-aurora', label: 'Soft Aurora' },
  { id: 'grain-haze', label: 'Grain Haze' },
  { id: 'signal-glitch', label: 'Signal Glitch' },
  { id: 'grid-scan', label: 'Grid Scan' },
  { id: 'pearl-shift', label: 'Pearl Shift' },
  { id: 'light-rays', label: 'Light Rays' },
  { id: 'storm-flash', label: 'Storm Flash' },
  { id: 'crystal-prism', label: 'Crystal Prism' },
] as const

export type ProfileBannerStyle = (typeof profileBannerStyles)[number]['id']

const profileBannerStyleIds = new Set(profileBannerStyles.map((style) => style.id))

export function normalizeProfileBannerStyle(value: string | null | undefined): ProfileBannerStyle {
  return profileBannerStyleIds.has(value as ProfileBannerStyle) ? (value as ProfileBannerStyle) : 'silk'
}

export function ProfileBannerBackground({
  reducedMotion,
  style,
}: {
  reducedMotion?: boolean
  style: ProfileBannerStyle
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        'track-profile-banner-background',
        `track-profile-banner-background-${style}`,
        reducedMotion ? 'reduced-motion' : '',
      ].filter(Boolean).join(' ')}
    >
      <span />
      <span />
      <span />
    </div>
  )
}

export function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    const handleChange = () => setReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return reducedMotion
}
