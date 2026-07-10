import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/deletion')({
  component: Deletion,
})

const deletionSteps = [
  'Open Track on mobile and sign in to the account you want to delete.',
  'Open the account menu from the Projects screen.',
  'Choose Delete account and confirm the deletion prompt.',
]

const retentionItems = [
  'Track removes personal profile fields and disables push notification subscriptions for the deleted account.',
  'Shared project messages, attachments, and audit events may be retained where needed for other project members, project integrity, contracts, legal obligations, security, or dispute resolution.',
  'If you cannot access the app, email support from the address associated with your Track account and ask for account deletion assistance.',
]

function Deletion() {
  return (
    <main className="bg-[var(--paper)] px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <p className="mono-label m-0 mb-2">Q9 Track</p>
        <h1 className="m-0 text-3xl font-semibold">Account Deletion</h1>
        <p className="m-0 mt-2 text-sm text-[var(--ink-3)]">
          Effective date: July 11, 2026
        </p>

        <div className="track-surface mt-6 rounded-md p-4">
          <p className="m-0 text-sm leading-6 text-[var(--ink-2)]">
            Track users can request account deletion from inside the mobile app.
            This page explains the deletion path and how shared project history is
            handled after a request.
          </p>
        </div>

        <div className="mt-8 space-y-7">
          <section>
            <h2 className="m-0 text-lg font-semibold">Delete Your Account in the App</h2>
            <ol className="m-0 mt-3 space-y-2 pl-5 text-sm leading-6 text-[var(--ink-3)]">
              {deletionSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="m-0 text-lg font-semibold">What Is Deleted or Retained</h2>
            <ul className="m-0 mt-3 space-y-2 pl-5 text-sm leading-6 text-[var(--ink-3)]">
              {retentionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="m-0 text-lg font-semibold">Contact</h2>
            <p className="m-0 mt-3 text-sm leading-6 text-[var(--ink-3)]">
              For deletion help, email{' '}
              <a className="font-semibold text-[var(--ink)]" href="mailto:q9labs.ai@gmail.com">
                q9labs.ai@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
