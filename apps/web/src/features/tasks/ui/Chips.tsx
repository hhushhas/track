import { CalendarDays } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export function MetadataChip({ children, leading, label }: { children: ReactNode; leading?: ReactNode; label?: string }) {
  return <span aria-label={label} className="task-chip">{leading ? <span className="task-chip-leading">{leading}</span> : null}{children}</span>
}

export type DueStatus = 'default' | 'soon' | 'overdue'
export function DueChip({ date, status = 'default' }: { date: string; status?: DueStatus }) {
  const text = status === 'overdue' ? `${date} · overdue` : date
  return <span aria-label={`Due ${text}`} className={`task-chip task-due-chip task-due-chip--${status}`}><CalendarDays aria-hidden="true" size={14} /><span>{text}</span></span>
}

export function LabelChip({ color, label }: { color: string; label: string }) {
  return <span className="task-chip"><span aria-hidden="true" className="task-label-dot" style={{ '--label-color': color } as CSSProperties} />{label}</span>
}
