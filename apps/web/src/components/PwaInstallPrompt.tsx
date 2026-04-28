import { Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'track:pwa-install-dismissed'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent)
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [showIosPrompt, setShowIosPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === 'true'
    setDismissed(wasDismissed)

    if (wasDismissed || isStandalone()) return

    setShowIosPrompt(isIosSafari())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
      setShowIosPrompt(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  if (dismissed || (!installEvent && !showIosPrompt)) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      window.localStorage.setItem(DISMISS_KEY, 'true')
      setDismissed(true)
    }
    setInstallEvent(null)
  }

  return (
    <aside className="track-pwa-install" aria-label="Install Track">
      <div className="track-pwa-install-icon" aria-hidden="true">
        {showIosPrompt ? <Share2 size={17} /> : <Download size={17} />}
      </div>
      <div className="track-pwa-install-copy">
        <p>Install Track</p>
        {showIosPrompt ? <span>Share, then Add to Home Screen.</span> : <span>Open faster from your home screen.</span>}
      </div>
      {installEvent ? (
        <button className="track-pwa-install-action" type="button" onClick={install}>
          Install
        </button>
      ) : null}
      <button className="track-pwa-install-dismiss" type="button" onClick={dismiss} aria-label="Dismiss install prompt">
        <X size={16} />
      </button>
    </aside>
  )
}
