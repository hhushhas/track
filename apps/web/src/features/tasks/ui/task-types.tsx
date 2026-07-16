import type { ReactNode } from 'react'

import type { DueStatus } from './Chips'
import type { TaskPriority } from './PriorityGlyph'
import type { StateCategory } from './StateRing'

export interface TaskAssignee {
  name: string
  avatarUrl?: string
  fallback?: ReactNode
}

export interface TaskPresentation {
  key: string
  title: string
  state: { category: StateCategory; name: string }
  assignee?: TaskAssignee
  due?: { date: string; status?: DueStatus }
  priority: TaskPriority
  origin?: string
  subtaskProgress?: string
}

export type SurfaceStatus = 'ready' | 'loading' | 'empty' | 'error'

export function AssigneeAvatar({ assignee, size = 20 }: { assignee: TaskAssignee; size?: number }) {
  return <span className="task-avatar" style={{ width: size, height: size }} title={assignee.name}>
    {assignee.avatarUrl ? <img alt="" src={assignee.avatarUrl} /> : <span aria-hidden="true">{assignee.fallback ?? assignee.name.slice(0, 1)}</span>}
    <span className="task-visually-hidden">Assigned to {assignee.name}</span>
  </span>
}

export function SurfaceState({ status, emptyMessage, onRetry }: { status: Exclude<SurfaceStatus, 'ready'>; emptyMessage: string; onRetry?: () => void }) {
  if (status === 'loading') return <div aria-busy="true" aria-label="Loading tasks" className="task-surface-state"><span className="task-skeleton" /><span className="task-skeleton" /></div>
  if (status === 'error') return <div role="alert" className="task-surface-state"><span>Tasks could not be loaded.</span>{onRetry ? <button type="button" onClick={onRetry}>Try again</button> : null}</div>
  return <div className="task-surface-state">{emptyMessage}</div>
}
