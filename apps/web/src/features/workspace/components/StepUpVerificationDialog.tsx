import type { FormEvent } from 'react'
import { ShieldCheck, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

export type StepUpMethod = 'totp' | 'backup_code'

type StepUpVerificationDialogProps = {
  busy: boolean
  code: string
  message: string
  method: StepUpMethod
  onCancel: () => void
  onCodeChange: (code: string) => void
  onMethodChange: (method: StepUpMethod) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function StepUpVerificationDialog({
  busy,
  code,
  message,
  method,
  onCancel,
  onCodeChange,
  onMethodChange,
  onSubmit,
}: StepUpVerificationDialogProps) {
  return (
    <aside aria-label="Two-factor verification" className="track-step-up-float">
      <div className="track-step-up-panel">
        <button
          aria-label="Dismiss verification"
          className="track-step-up-close"
          onClick={onCancel}
          type="button"
        >
          <X size={16} />
        </button>
        <div className="track-step-up-icon">
          <ShieldCheck size={18} />
        </div>
        <div className="track-step-up-copy">
          <strong>Verify this action</strong>
          <span>Export project records</span>
          <p>Use two-factor once. It stays trusted for 10 minutes.</p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="track-two-factor-methods">
            <Button
              className={method === 'totp' ? 'track-button track-button-primary' : 'track-button'}
              onClick={() => onMethodChange('totp')}
              type="button"
            >
              Authenticator
            </Button>
            <Button
              className={method === 'backup_code' ? 'track-button track-button-primary' : 'track-button'}
              onClick={() => onMethodChange('backup_code')}
              type="button"
            >
              Backup code
            </Button>
          </div>
          <Input
            aria-label={method === 'backup_code' ? 'Backup code' : 'Authenticator code'}
            autoComplete="one-time-code"
            inputMode={method === 'backup_code' ? 'text' : 'numeric'}
            onChange={(event) => onCodeChange(event.currentTarget.value)}
            placeholder={method === 'backup_code' ? 'XXXX-XXXXXX' : '123456'}
            value={code}
          />
          {message ? <p className="track-auth-error">{message}</p> : null}
          <div className="track-step-up-actions">
            <Button className="track-button" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button className="track-button track-button-primary" disabled={busy} type="submit">
              Verify and continue
            </Button>
          </div>
        </form>
      </div>
    </aside>
  )
}
