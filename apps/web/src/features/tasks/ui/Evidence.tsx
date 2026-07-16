import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function OriginDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={['task-origin-dot', className].filter(Boolean).join(' ')} />
}

export function EvidenceFooter({ caption, onActivate }: { caption: string; onActivate?: () => void }) {
  const content = <><OriginDot /><span>{caption}</span><ChevronRight aria-hidden="true" className="task-evidence-chevron" size={14} /></>
  return onActivate ? (
    <button className="task-evidence-footer task-evidence-footer--action" onClick={onActivate} type="button" aria-label={caption}>{content}</button>
  ) : <div className="task-evidence-footer">{content}</div>
}

export function OriginConnector({ label = 'Connection to source message' }: { label?: string }) {
  return (
    <svg aria-label={label} className="task-origin-connector" preserveAspectRatio="none" role="img" viewBox="0 0 48 96">
      <path d="M7 7 C7 55 41 42 41 89" />
      <circle cx="7" cy="7" r="5" /><circle cx="41" cy="89" r="5" />
      <circle className="task-origin-connector-cutout" cx="7" cy="7" r="2" />
      <circle className="task-origin-connector-cutout" cx="41" cy="89" r="2" />
    </svg>
  )
}

/** Places the shared message quote beside the evidence connector without coupling it to task data. */
export function EvidenceSourceQuote({ caption = 'Source message', children }: { caption?: string; children: ReactNode }) {
  return <section aria-label={caption} className="task-evidence-source"><OriginConnector /><div className="task-evidence-source-quote">{children}</div></section>
}
