import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/two-factor')({ component: TwoFactor })

function TwoFactor() {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  return (
    <main className="min-h-[calc(100vh-48px)] bg-[var(--paper)] px-4 py-10">
      <section className="mx-auto max-w-[420px]">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--ink)]">
          <ShieldCheck size={19} />
        </div>
        <p className="mono-label m-0">Two-Factor</p>
        <h1 className="m-0 mt-2 text-2xl font-semibold">Enter your authenticator code</h1>

        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void authClient.twoFactor.verifyTotp({ code }).then(({ error }) => {
              if (error) {
                setMessage(error.message ?? 'Invalid two-factor code.')
                return
              }
              window.location.href = '/'
            })
          }}
        >
          <input
            aria-label="Authenticator code"
            autoComplete="one-time-code"
            className="min-h-11 w-full rounded-md border border-[var(--hairline-strong)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            inputMode="numeric"
            onChange={(event) => setCode(event.currentTarget.value)}
            placeholder="123456"
            value={code}
          />
          <button className="track-button track-button-primary w-full" type="submit">
            Verify
          </button>
          {message ? (
            <p className="m-0 text-sm text-[var(--danger)]">{message}</p>
          ) : null}
        </form>
      </section>
    </main>
  )
}
