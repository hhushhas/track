import { CheckCircle2 } from 'lucide-react'

import { DueChip, MetadataChip } from './Chips'
import { EvidenceFooter } from './Evidence'
import { PriorityGlyph } from './PriorityGlyph'
import { StateRing } from './StateRing'
import { AssigneeAvatar, type TaskPresentation } from './task-types'

export interface InlineTaskCardProps {
  task: TaskPresentation
  evidenceCaption: string
  onOpen: (taskKey: string) => void
}

export function InlineTaskCard({ task, evidenceCaption, onOpen }: InlineTaskCardProps) {
  return <article className="task-inline-card">
    <button aria-label={`Open task ${task.key}: ${task.title}`} className="task-inline-card-main" type="button" onClick={() => onOpen(task.key)}>
      <span className="task-inline-title-row"><StateRing category={task.state.category} label={task.state.name} /><strong>{task.title}</strong><code>{task.key}</code></span>
      <span className="task-inline-props">
        {task.assignee ? <MetadataChip leading={<AssigneeAvatar assignee={task.assignee} size={14} />}>{task.assignee.name}</MetadataChip> : null}
        {task.due ? <DueChip {...task.due} /> : null}
        <PriorityGlyph priority={task.priority} showLabel />
        {task.subtaskProgress ? <MetadataChip leading={<CheckCircle2 aria-hidden="true" size={14} />}>{task.subtaskProgress}</MetadataChip> : null}
      </span>
    </button>
    <EvidenceFooter caption={evidenceCaption} onActivate={() => onOpen(task.key)} />
  </article>
}
