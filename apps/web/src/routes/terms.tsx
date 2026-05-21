import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: Terms,
})

const sections = [
  {
    title: 'Use of Track',
    body: 'Track is provided for business project communication, evidence review, and audit workflows. You are responsible for using Track only with content and collaborators you are authorized to manage.',
  },
  {
    title: 'Project Content',
    body: 'Messages, attachments, voice notes, assistant interactions, reports, records, and audit history may be visible to users with access to the relevant project or group. Project owners are responsible for inviting the right collaborators and managing access.',
  },
  {
    title: 'AI Features',
    body: 'Track Assistant and AI review features can help summarize, answer, or classify project conversation content. AI output should be reviewed before it is relied on for legal, billing, operational, or contractual decisions.',
  },
  {
    title: 'Accounts and Security',
    body: 'You must keep your account secure, use accurate profile information, and notify us if you believe your account or project access has been compromised.',
  },
  {
    title: 'Retention and Deletion',
    body: 'Personal profile data can be corrected or deleted as described in the Privacy Policy. Some project evidence, audit history, and records may be retained where needed for project integrity, contracts, legal obligations, or dispute resolution.',
  },
]

function Terms() {
  return (
    <main className="bg-[var(--paper)] px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <p className="mono-label m-0 mb-2">Q9 Track</p>
        <h1 className="m-0 text-3xl font-semibold">Terms</h1>
        <p className="m-0 mt-2 text-sm text-[var(--ink-3)]">
          Effective date: May 16, 2026
        </p>

        <div className="track-surface mt-6 rounded-md p-4">
          <p className="m-0 text-sm leading-6 text-[var(--ink-2)]">
            These terms summarize the business-use expectations for Track. They are
            provided so mobile and web users can review the basic account, content,
            AI, and retention rules before and during use of the product.
          </p>
        </div>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="m-0 text-lg font-semibold">{section.title}</h2>
              <p className="m-0 mt-3 text-sm leading-6 text-[var(--ink-3)]">
                {section.body}
              </p>
            </section>
          ))}

          <section>
            <h2 className="m-0 text-lg font-semibold">Contact</h2>
            <p className="m-0 mt-3 text-sm leading-6 text-[var(--ink-3)]">
              For access, billing, support, or terms questions, contact{' '}
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
