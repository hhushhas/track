import { createFileRoute } from '@tanstack/react-router'
import { FileCheck2, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/sign-in')({ component: SignIn })

function SignIn() {
  return (
    <main className="track-auth-page">
      <section className="track-auth-shell">
        <div className="track-auth-story">
          <img
            alt="Track"
            className="track-auth-logo"
            height={70}
            src="/track-logo.svg"
            width={160}
          />
          <div>
            <p className="mono-label m-0">Project record workspace</p>
            <h1>Turn project conversations into accountable records.</h1>
            <p>
              Track keeps client and vendor teams aligned around decisions,
              evidence, action items, and audit-ready exports.
            </p>
          </div>
          <div className="track-auth-proof">
            <span><MessageSquareText size={16} /> Shared conversation</span>
            <span><FileCheck2 size={16} /> Accepted records</span>
            <span><ShieldCheck size={16} /> Permissioned access</span>
          </div>
        </div>

        <div className="track-auth-panel">
          <p className="mono-label m-0">Track Access</p>
          <h2>Sign in to continue</h2>
          <p>
            Use the Google account invited to your Track project. Two-factor
            verification appears next when enabled.
          </p>

          <Button
            className="track-button track-button-primary track-auth-button"
            onClick={() =>
              void authClient.signIn.social({
                provider: 'google',
                callbackURL: '/workspace',
              })
            }
            type="button"
          >
            <img alt="" height={18} src="/google-g.svg" width={18} />
            Continue with Google
          </Button>

          <div className="track-auth-note">
            <ShieldCheck size={16} />
            <span>Project and group membership control what you can see.</span>
          </div>
        </div>
      </section>
    </main>
  )
}
