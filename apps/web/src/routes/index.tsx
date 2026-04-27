import { createFileRoute } from '@tanstack/react-router'
import {
  Bell,
  Check,
  Download,
  FileText,
  MessageSquarePlus,
  Paperclip,
  Play,
  Send,
  UserPlus,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  demoAuditEvents,
  demoGroups,
  demoMessages,
  demoMetrics,
  demoRecords,
} from '@track/shared'

export const Route = createFileRoute('/')({ component: App })

const notificationModes = ['inherit', 'all', 'mentions', 'none'] as const

type ThreadMessage = {
  id: string
  author: string
  role: string
  body: string
  time: string
  tone: 'client' | 'staff' | 'ai'
}

type DraftRecord = {
  id: string
  title: string
  type: string
  evidence: string
  status: 'pending' | 'accepted' | 'declined'
}

type ProjectRecord = {
  id: string
  type: string
  title: string
  classification: string
  status: string
  owner: string
  evidence: readonly string[] | string[]
}

function App() {
  const [activeGroupId, setActiveGroupId] = useState<string>(demoGroups[0]?.id ?? '')
  const [composer, setComposer] = useState('')
  const [messages, setMessages] = useState<ThreadMessage[]>([...demoMessages])
  const [drafts, setDrafts] = useState<DraftRecord[]>([
    {
      id: 'DR-208',
      title: 'Invoice audit trail in export',
      type: 'scope_change',
      evidence: 'Amina requested invoice audit trail inclusion.',
      status: 'pending',
    },
    {
      id: 'DR-207',
      title: 'Client summary PDF separate from full audit packet',
      type: 'decision',
      evidence: 'Hasan confirmed the export split in General.',
      status: 'pending',
    },
  ])
  const [records, setRecords] = useState<ProjectRecord[]>([...demoRecords])
  const [notificationMode, setNotificationMode] =
    useState<(typeof notificationModes)[number]>('mentions')
  const [inviteEmail, setInviteEmail] = useState('')

  const activeGroup = demoGroups.find((group) => group.id === activeGroupId) ?? demoGroups[0]
  const pendingDrafts = drafts.filter((draft) => draft.status === 'pending')
  const metrics = useMemo(
    () => [
      ...demoMetrics,
      { label: 'Pending', value: String(pendingDrafts.length) },
      { label: 'Mode', value: notificationMode },
    ],
    [notificationMode, pendingDrafts.length],
  )

  function sendMessage() {
    const body = composer.trim()
    if (!body) return

    const isTrackQuestion = body.toLowerCase().includes('@track')
    setMessages((current) => [
      ...current,
      {
        id: `msg-local-${Date.now()}`,
        author: 'Hasan',
        role: 'owner',
        body,
        time: 'now',
        tone: 'staff',
      },
      ...(isTrackQuestion
        ? [
            {
              id: `msg-track-${Date.now()}`,
              author: 'Track Assistant',
              role: 'system',
              body: 'Yes, that is supported by the current thread. Evidence: the client asked for invoice audit trail coverage and Hasan accepted it as an export capability.',
              time: 'now',
              tone: 'ai',
            } as const,
          ]
        : []),
    ])
    setComposer('')
  }

  function runReview() {
    const nextId = `DR-${210 + drafts.length}`
    setDrafts((current) => [
      {
        id: nextId,
        title: 'Review latest client request for scope impact',
        type: 'task',
        evidence: 'Generated from the latest General conversation.',
        status: 'pending',
      },
      ...current,
    ])
    setMessages((current) => [
      ...current,
      {
        id: `msg-review-${Date.now()}`,
        author: 'Track AI Review',
        role: 'system',
        body: `Draft Record proposed: ${nextId} needs review in the project record.`,
        time: 'now',
        tone: 'ai',
      },
    ])
  }

  function acceptDraft(draftId: string, classification: string) {
    const draft = drafts.find((item) => item.id === draftId)
    if (!draft) return
    setDrafts((current) =>
      current.map((item) =>
        item.id === draftId ? { ...item, status: 'accepted' } : item,
      ),
    )
    setRecords((current) => [
      {
        id: draft.id.replace('DR', 'REC'),
        type: draft.type,
        title: draft.title,
        classification,
        status: 'accepted',
        owner: 'Hasan Shoaib',
        evidence: [draft.evidence],
      },
      ...current,
    ])
  }

  return (
    <main className="grid h-[calc(100vh-48px)] grid-cols-1 overflow-hidden bg-[var(--paper)] lg:grid-cols-[248px_minmax(0,1fr)_344px]">
      <aside className="hidden border-r border-[var(--hairline)] bg-[var(--paper-2)] p-3 lg:block">
        <div className="mb-4 flex items-center justify-between">
          <p className="mono-label m-0">Projects</p>
          <button className="icon-button" title="Create project" type="button">
            <MessageSquarePlus size={15} />
          </button>
        </div>

        <div className="track-surface mb-4 rounded-md p-3">
          <p className="m-0 text-sm font-semibold">Q9 Track</p>
          <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">Internal product build</p>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="mono-label m-0">Groups</p>
          <button className="icon-button" title="Create group" type="button">
            <MessageSquarePlus size={15} />
          </button>
        </div>
        <div className="space-y-2">
          {demoGroups.map((group) => (
            <button
              className={
                group.id === activeGroupId
                  ? 'group-button group-button-active'
                  : 'group-button'
              }
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
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
          <p className="mono-label m-0 mb-2">Metrics</p>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <div className="track-surface rounded-md p-3" key={metric.label}>
                <p className="m-0 truncate text-lg font-semibold">{metric.value}</p>
                <p className="m-0 text-[11px] text-[var(--ink-3)]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--hairline)] bg-[var(--paper)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="mono-label m-0">{activeGroup?.name}</p>
              <h1 className="m-0 truncate text-[15px] font-semibold">
                Client/vendor thread
              </h1>
            </div>
            <button
              className="track-button track-button-accent ml-auto inline-flex items-center gap-2"
              onClick={runReview}
              type="button"
            >
              <Play size={14} />
              Review
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-[780px] flex-col gap-3">
            {messages.map((message) => (
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
          <div className="mx-auto flex max-w-[780px] gap-2">
            <button className="icon-button h-10 w-10" title="Attach file" type="button">
              <Paperclip size={16} />
            </button>
            <input
              aria-label="Message"
              className="min-h-10 flex-1 rounded-md border border-[var(--hairline-strong)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              onChange={(event) => setComposer(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendMessage()
              }}
              placeholder="Message General or ask @track..."
              value={composer}
            />
            <button
              className="track-button track-button-primary inline-flex items-center gap-2"
              onClick={sendMessage}
              type="button"
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--hairline)] bg-[var(--paper-2)] p-3 xl:block">
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button className="track-button inline-flex items-center justify-center gap-2" type="button">
            <UserPlus size={14} />
            Invite
          </button>
          <button className="track-button inline-flex items-center justify-center gap-2" type="button">
            <Download size={14} />
            Export
          </button>
        </div>

        <div className="track-surface mb-5 rounded-md p-3">
          <p className="mono-label m-0 mb-2">Invite</p>
          <div className="flex gap-2">
            <input
              aria-label="Invite email"
              className="min-h-9 min-w-0 flex-1 rounded-md border border-[var(--hairline-strong)] bg-[var(--paper)] px-2 text-sm outline-none focus:border-[var(--accent)]"
              onChange={(event) => setInviteEmail(event.currentTarget.value)}
              placeholder="person@client.com"
              value={inviteEmail}
            />
            <button className="icon-button h-9 w-9" title="Send invite" type="button">
              <Send size={14} />
            </button>
          </div>
        </div>

        <div className="track-surface mb-5 rounded-md p-3">
          <p className="mono-label m-0 mb-2">Notifications</p>
          <div className="grid grid-cols-2 gap-2">
            {notificationModes.map((mode) => (
              <button
                className={
                  mode === notificationMode
                    ? 'track-button track-button-accent justify-center'
                    : 'track-button justify-center'
                }
                key={mode}
                onClick={() => setNotificationMode(mode)}
                type="button"
              >
                <Bell size={13} />
                {mode}
              </button>
            ))}
          </div>
        </div>

        <p className="mono-label m-0 mb-2">Review Drafts</p>
        <div className="mb-5 space-y-2">
          {pendingDrafts.length > 0 ? (
            pendingDrafts.map((draft) => (
              <article className="track-surface rounded-md p-3" key={draft.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[var(--ink-3)]">{draft.id}</span>
                  <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10px]">
                    {draft.type}
                  </span>
                </div>
                <h2 className="m-0 text-sm font-semibold">{draft.title}</h2>
                <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--ink-3)]">
                  {draft.evidence}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="icon-button h-8"
                    onClick={() => acceptDraft(draft.id, 'billable_scope')}
                    title="Accept as billable"
                    type="button"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="icon-button h-8"
                    onClick={() => acceptDraft(draft.id, 'official_record')}
                    title="Accept as official"
                    type="button"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    className="icon-button h-8"
                    onClick={() =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.id === draft.id ? { ...item, status: 'declined' } : item,
                        ),
                      )
                    }
                    title="Decline"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="track-surface m-0 rounded-md p-3 text-sm text-[var(--ink-3)]">
              No pending drafts.
            </p>
          )}
        </div>

        <p className="mono-label m-0 mb-2">Project Record</p>
        <div className="space-y-2">
          {records.map((record) => (
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
