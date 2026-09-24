import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

type ThemeMode = 'light' | 'dark' | 'auto'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored
  }

  return 'auto'
}

const THEME_COLOR_LIGHT = '#f6f6f4'
const THEME_COLOR_DARK = '#171716'

function applyThemeColor(resolved: 'light' | 'dark') {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  }
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved
  applyThemeColor(resolved)
}

type ThemeToggleProps = {
  showLabel?: boolean
}

export default function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const initialMode = getInitialMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [mode])

  function setThemeMode(nextMode: ThemeMode) {
    setMode(nextMode)
    applyThemeMode(nextMode)
    window.localStorage.setItem('theme', nextMode)
  }

  const modeLabel = mode === 'auto' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'
  const Icon = mode === 'auto' ? Monitor : mode === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Appearance: ${modeLabel}`}
        className={showLabel ? 'track-theme-toggle track-theme-toggle-labeled' : 'track-theme-toggle'}
        title={`Appearance: ${modeLabel}`}
      >
        <Icon aria-hidden="true" size={14} />
        {showLabel ? <><span>Appearance</span><small>{modeLabel}</small></> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="track-theme-menu" side="top" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            aria-label="Color mode"
            onValueChange={(value) => setThemeMode(value as ThemeMode)}
            value={mode}
          >
            <DropdownMenuRadioItem value="auto"><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light"><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
