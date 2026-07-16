export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

const labels: Record<TaskPriority, string> = { none: 'No priority', low: 'Low priority', medium: 'Medium priority', high: 'High priority', urgent: 'Urgent' }

export function PriorityGlyph({ priority, showLabel = false }: { priority: TaskPriority; showLabel?: boolean }) {
  const label = labels[priority]
  return (
    <span aria-label={label} className={`task-priority task-priority--${priority}`} role="img" title={label}>
      <span aria-hidden="true" className="task-priority-bars"><i /><i /><i /></span>
      {priority === 'urgent' || showLabel ? <span className="task-priority-label">{label}</span> : null}
    </span>
  )
}
