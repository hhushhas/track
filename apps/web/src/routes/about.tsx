import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mono-label m-0 mb-2">Track</p>
      <h1 className="m-0 text-2xl font-semibold">Shared project memory.</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-3)]">
        Track is a client/vendor project workspace that keeps conversation,
        evidence, shared memory, and permission-aware AI assistance together.
      </p>
    </main>
  )
}
