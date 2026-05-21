export default function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--paper)] px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-[12px] text-[var(--ink-3)]">
        <span>Q9 Track</span>
        <div className="flex items-center gap-3">
          <a className="font-medium text-[var(--ink)]" href="/privacy">
            Privacy
          </a>
          <a className="font-medium text-[var(--ink)]" href="/terms">
            Terms
          </a>
        </div>
      </div>
    </footer>
  )
}
