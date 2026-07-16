import type { CSSProperties } from 'react'

export type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
export type StateRingSize = 'dense' | 'subtask' | 'default'

const pixels: Record<StateRingSize, number> = { dense: 12, subtask: 13, default: 14 }

export function StateRing({ category, label, size = 'default', className }: {
  category: StateCategory
  label: string
  size?: StateRingSize
  className?: string
}) {
  const dimension = pixels[size]
  return (
    <span
      aria-label={label}
      className={['task-state-ring-label', className].filter(Boolean).join(' ')}
      role="img"
      title={label}
    >
      <span
        aria-hidden="true"
        className={`task-state-ring task-state-ring--${category}`}
        data-category={category}
        style={{ '--state-ring-size': `${dimension}px` } as CSSProperties}
      />
    </span>
  )
}
