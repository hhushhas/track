import { demoCurrentUser, demoProject } from '@track/shared'

export default function Header() {
  return (
    <header className="flex h-12 items-center border-b border-[var(--hairline)] bg-[var(--paper)] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ink)] text-[var(--accent)]">
          <span className="font-mono text-xs font-semibold">T</span>
        </div>
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold">{demoProject.name}</p>
          <p className="m-0 truncate text-[11px] text-[var(--ink-3)]">
            {demoProject.clientLabel}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="track-button hidden sm:inline-flex" type="button">
          Invite
        </button>
        <button className="track-button track-button-accent" type="button">
          Run AI Review
        </button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-semibold text-[var(--paper)]">
          {demoCurrentUser.initials}
        </div>
      </div>
    </header>
  )
}
