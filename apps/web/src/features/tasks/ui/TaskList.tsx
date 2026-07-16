import { DueChip } from './Chips'
import { OriginDot } from './Evidence'
import { PriorityGlyph } from './PriorityGlyph'
import { StateRing } from './StateRing'
import { AssigneeAvatar, SurfaceState, type SurfaceStatus, type TaskPresentation } from './task-types'

export interface TaskGroup { id: string; name: string; category: TaskPresentation['state']['category']; tasks: TaskPresentation[] }

export function TaskRow({ task, hideAssignee = false, onOpen }: { task: TaskPresentation; hideAssignee?: boolean; onOpen: (key: string) => void }) {
  return <button aria-label={`Open task ${task.key}: ${task.title}`} className={`task-list-row${hideAssignee ? ' task-list-row--mine' : ''}`} type="button" onClick={() => onOpen(task.key)}><StateRing category={task.state.category} label={task.state.name} size="dense" /><code>{task.key}</code><strong>{task.title}</strong><span className="task-list-origin">{task.origin ? <><OriginDot />{task.origin}</> : null}</span><span>{task.due ? <DueChip {...task.due} /> : null}</span>{hideAssignee ? null : <span>{task.assignee ? <AssigneeAvatar assignee={task.assignee} /> : null}</span>}<PriorityGlyph priority={task.priority} /></button>
}

export function TaskList({ groups, mode = 'all', status = 'ready', onRetry, onOpenTask }: { groups: TaskGroup[]; mode?: 'all' | 'my-tasks'; status?: SurfaceStatus; onRetry?: () => void; onOpenTask: (key: string) => void }) {
  if (status !== 'ready') return <SurfaceState emptyMessage={mode === 'my-tasks' ? 'No tasks are assigned to you.' : 'No tasks match this view.'} onRetry={onRetry} status={status} />
  return <div aria-label={mode === 'my-tasks' ? 'My tasks' : 'Task list'} className="task-list" role="region">{groups.map(group => <section key={group.id}><header><StateRing category={group.category} label={group.name} /><strong>{group.name}</strong><span>{group.tasks.length}</span></header>{group.tasks.map(task => <TaskRow hideAssignee={mode === 'my-tasks'} key={task.key} task={task} onOpen={onOpenTask} />)}</section>)}</div>
}
