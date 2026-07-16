import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-foreground">
      <section className="max-w-md text-center" aria-labelledby="not-found-title">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground">404</p>
        <h1 id="not-found-title" className="mt-3 text-4xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This page may have moved, or the address may be incorrect.
        </p>
        <Link
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          to="/">
          Return to Track
        </Link>
      </section>
    </main>
  )
}
