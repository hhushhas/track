import { createFileRoute } from '@tanstack/react-router'
import { LogIn, ShieldCheck } from 'lucide-react'

import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/sign-in')({ component: SignIn })

function SignIn() {
  return (
    <main className="min-h-[calc(100vh-48px)] bg-[var(--paper)] px-4 py-10">
      <section className="mx-auto max-w-[420px]">
        <p className="mono-label m-0">Track Access</p>
        <h1 className="m-0 mt-2 text-2xl font-semibold">Sign in to the project record</h1>
        <p className="m-0 mt-2 text-sm leading-6 text-[var(--ink-3)]">
          Google OAuth is the only identity path. TOTP is supported for accounts that
          have two-factor enabled.
        </p>

        <div className="mt-6 space-y-3">
          <button
            className="track-button track-button-primary flex w-full items-center justify-center gap-2"
            onClick={() =>
              void authClient.signIn.social({
                provider: 'google',
                callbackURL: '/',
              })
            }
            type="button"
          >
            <LogIn size={16} />
            Continue with Google
          </button>

          <div className="track-surface flex items-start gap-3 rounded-md p-3 text-sm text-[var(--ink-3)]">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={16} />
            <span>
              Staff, Client, Admin, and Owner access is granted inside each project.
              Group membership controls conversation visibility.
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
