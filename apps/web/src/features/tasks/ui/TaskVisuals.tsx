import { CalendarDays } from 'lucide-react'
import { getTaskDueState } from '@track/shared/tasks'

import type { Doc } from '../../../../../../convex/_generated/dataModel'
import type { TaskView } from '../task-types'

type StateCategory = Doc<'taskWorkflowStates'>['category']
type Priority = Doc<'tasks'>['priority']

export function StateRing({ category, size = 'default' }: { category: StateCategory; size?: 'default' | 'dense' | 'subtask' }) {
  return <span aria-hidden="true" className={`task-state-ring ${category} ${size}`} />
}

export function PriorityGlyph({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  return (
    <span aria-label={`Priority: ${priority}`} className={`task-priority-glyph ${priority}`} role="img">
      <span aria-hidden="true"><i /><i /><i /></span>
      {showLabel ? <em>{priority}</em> : null}
    </span>
  )
}

export function TaskAvatar({ member, size = 'default' }: { member: Doc<'projectMembers'> | null; size?: 'default' | 'rail' }) {
  const name = member?.userDisplayNameSnapshot ?? 'Unassigned'
  const initials = member
    ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : '–'
  return <span aria-label={name} className={`task-person-avatar ${size}`} role="img" title={name}>{initials}</span>
}

export function DueChip({ dueDate, terminal = false }: { dueDate?: string; terminal?: boolean }) {
  if (!dueDate) return null
  const today = new Date().toLocaleDateString('en-CA')
  const overdue = getTaskDueState(dueDate, today, terminal) === 'overdue'
  return (
    <span className={`task-due-chip${overdue ? ' overdue' : ''}`}>
      <CalendarDays aria-hidden="true" size={10} />
      {formatTaskDate(dueDate)}{overdue ? ' · overdue' : ''}
    </span>
  )
}

export function formatTaskDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function OriginCaption({ item, boardName }: { item: TaskView; boardName?: string }) {
  const reference = item.references.find((candidate) => candidate.isPrimary) ?? item.references[0]
  if (!reference) return null
  const source = reference.channelThreadId
    ? 'Thread'
    : reference.type === 'message'
      ? 'Channel message'
      : reference.type.replaceAll('_', ' ')
  return (
    <span className="task-origin-caption" title={`${source}${boardName ? ` · ${boardName}` : ''}`}>
      <span className="task-origin-dot" />
      <em>{source}{boardName ? ` · ${boardName}` : ''}</em>
    </span>
  )
}

export function TaskDenseRow({ item, onOpen, omitAssignee = false }: { item: TaskView; onOpen: () => void; omitAssignee?: boolean }) {
  const category = item.state?.category ?? 'backlog'
  return (
    <button className={`task-list-row${item.terminal ? ' terminal' : ''}${omitAssignee ? ' omit-assignee' : ''}`} onClick={onOpen} type="button">
      <StateRing category={category} size="dense" />
      <span className="task-list-key">{item.task.publicKey}</span>
      <strong>{item.task.title}</strong>
      <OriginCaption boardName={item.board?.name} item={item} />
      <DueChip dueDate={item.task.dueDate} terminal={item.terminal} />
      {!omitAssignee ? <TaskAvatar member={item.assignee} /> : null}
      <PriorityGlyph priority={item.task.priority} />
    </button>
  )
}
