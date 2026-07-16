import { Filter, Plus } from 'lucide-react'

import { DueChip } from './Chips'
import { OriginDot } from './Evidence'
import { PriorityGlyph } from './PriorityGlyph'
import { StateRing } from './StateRing'
import { AssigneeAvatar, SurfaceState, type SurfaceStatus, type TaskPresentation } from './task-types'

export interface TaskColumnData { id: string; name: string; category: TaskPresentation['state']['category']; tasks: TaskPresentation[] }
export interface TaskSuggestion { id: string; title: string; source: string }

export function BoardHeader({ name, scope, view, onViewChange, onFilter, onNewTask }: { name: string; scope: string; view: 'board' | 'list'; onViewChange: (view: 'board' | 'list') => void; onFilter: () => void; onNewTask: () => void }) {
  return <header className="task-board-header"><div><h2>{name}</h2><span className="task-scope-pill">{scope}</span></div><div className="task-board-actions"><div aria-label="Task view" className="task-segmented" role="group"><button aria-pressed={view === 'board'} type="button" onClick={() => onViewChange('board')}>Board</button><button aria-pressed={view === 'list'} type="button" onClick={() => onViewChange('list')}>List</button></div><button type="button" onClick={onFilter}><Filter aria-hidden="true" size={14} /> Filter</button><button className="task-primary-button" type="button" onClick={onNewTask}><Plus aria-hidden="true" size={14} /> New task</button></div></header>
}

export function BoardTaskCard({ task, onOpen }: { task: TaskPresentation; onOpen: (key: string) => void }) {
  const terminal = task.state.category === 'completed' || task.state.category === 'canceled'
  return <button aria-label={`Open task ${task.key}: ${task.title}`} className={`task-board-card${terminal ? ' task-board-card--terminal' : ''}`} type="button" onClick={() => onOpen(task.key)}><span className="task-board-key"><code>{task.key}</code><StateRing category={task.state.category} label={task.state.name} size="dense" /></span><strong>{task.title}</strong><span className="task-board-card-footer">{task.assignee ? <AssigneeAvatar assignee={task.assignee} /> : null}{task.origin ? <span className="task-origin-caption"><OriginDot />{task.origin}</span> : null}<span className="task-card-spacer" />{task.due ? <DueChip {...task.due} /> : null}<PriorityGlyph priority={task.priority} /></span></button>
}

export function SuggestionInbox({ suggestions, onAccept, onDismiss }: { suggestions: TaskSuggestion[]; onAccept: (id: string) => void; onDismiss: (id: string) => void }) {
  if (!suggestions.length) return null
  return <section aria-labelledby="suggestion-inbox-title" className="task-suggestion-inbox"><header><strong id="suggestion-inbox-title">Suggestion inbox</strong><span>Track spotted these in conversation — nothing becomes a task until you accept it.</span></header>{suggestions.map(item => <div className="task-suggestion-row" key={item.id}><OriginDot /><span><strong>{item.title}</strong><small>{item.source}</small></span><button className="task-primary-button" type="button" onClick={() => onAccept(item.id)}>Accept</button><button type="button" onClick={() => onDismiss(item.id)}>Dismiss</button></div>)}</section>
}

export function TaskBoard({ columns, status = 'ready', onRetry, onOpenTask, onAddTask }: { columns: TaskColumnData[]; status?: SurfaceStatus; onRetry?: () => void; onOpenTask: (key: string) => void; onAddTask: (columnId: string) => void }) {
  if (status !== 'ready') return <SurfaceState emptyMessage="No tasks on this board yet." onRetry={onRetry} status={status} />
  return <div aria-label="Task board" className="task-board" role="region">{columns.map(column => <section className="task-board-column" key={column.id}><header><StateRing category={column.category} label={column.name} /><strong>{column.name}</strong><span>{column.tasks.length}</span><button aria-label={`Add task to ${column.name}`} title={`Add task to ${column.name}`} type="button" onClick={() => onAddTask(column.id)}><Plus aria-hidden="true" size={15} /></button></header><div>{column.tasks.map(task => <BoardTaskCard key={task.key} task={task} onOpen={onOpenTask} />)}</div></section>)}</div>
}
