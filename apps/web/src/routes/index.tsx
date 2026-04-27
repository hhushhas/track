import { createFileRoute } from '@tanstack/react-router'
import {
  demoAuditEvents,
  demoGroups,
  demoMessages,
  demoMetrics,
  demoRecords,
} from '@track/shared'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="grid h-[calc(100vh-48px)] grid-cols-1 overflow-hidden bg-[var(--paper)] lg:grid-cols-[232px_minmax(0,1fr)_312px]">
      <aside className="hidden border-r border-[var(--hairline)] bg-[var(--paper-2)] p-3 lg:block">
        <div className="mb-4 flex items-center justify-between">
          <p className="mono-label m-0">Groups</p>
          <button className="track-button" type="button">
            New
          </button>
        </div>
        <div className="space-y-2">
          {demoGroups.map((group) => (
            <button
              className="flex w-full items-center justify-between rounded-md border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2 text-left"
              key={group.id}
              type="button"
            >
              <span>
                <span className="block text-sm font-semibold">{group.name}</span>
                <span className="block text-[11px] text-[var(--ink-3)]">
                  {group.visibility}
                </span>
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px]">
                {group.unreadCount}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="mono-label m-0 mb-2">Project Metrics</p>
          <div className="grid grid-cols-2 gap-2">
            {demoMetrics.map((metric) => (
              <div className="track-surface rounded-md p-3" key={metric.label}>
                <p className="m-0 text-xl font-semibold">{metric.value}</p>
                <p className="m-0 text-[11px] text-[var(--ink-3)]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--hairline)] bg-[var(--paper)] px-4 py-3">
          <p className="mono-label m-0">General</p>
          <h1 className="m-0 text-[15px] font-semibold">Client/vendor thread</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-[760px] flex-col gap-3">
            {demoMessages.map((message) => (
              <article
                className={
                  message.tone === 'ai'
                    ? 'rounded-md border border-[var(--accent)] bg-[var(--accent-tint)] p-3'
                    : 'rounded-md border border-[var(--hairline)] bg-[var(--paper)] p-3'
                }
                key={message.id}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{message.author}</span>
                  <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">
                    {message.role}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[var(--ink-3)]">
                    {message.time}
                  </span>
                </div>
                <p className="m-0 text-sm leading-6 text-[var(--ink-2)]">{message.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--hairline)] bg-[var(--paper-2)] p-3">
          <div className="mx-auto flex max-w-[760px] gap-2">
            <input
              aria-label="Message"
              className="min-h-10 flex-1 rounded-md border border-[var(--hairline-strong)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Message General or ask @track..."
            />
            <button className="track-button track-button-primary" type="button">
              Send
            </button>
          </div>
        </div>
      </section>

      <aside className="hidden border-l border-[var(--hairline)] bg-[var(--paper-2)] p-3 xl:block">
        <p className="mono-label m-0 mb-2">Project Record</p>
        <div className="space-y-2">
          {demoRecords.map((record) => (
            <article className="track-surface rounded-md p-3" key={record.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--ink-3)]">{record.id}</span>
                <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10px]">
                  {record.classification}
                </span>
              </div>
              <h2 className="m-0 text-sm font-semibold">{record.title}</h2>
              <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">
                {record.type} · {record.status} · {record.owner}
              </p>
            </article>
          ))}
        </div>

        <p className="mono-label m-0 mb-2 mt-5">Audit Trail</p>
        <div className="space-y-2">
          {demoAuditEvents.map((event) => (
            <p
              className="m-0 rounded-md border border-[var(--hairline)] bg-[var(--paper)] p-2 text-[12px] text-[var(--ink-3)]"
              key={event}
            >
              {event}
            </p>
          ))}
        </div>
      </aside>
    </main>
  )
}
