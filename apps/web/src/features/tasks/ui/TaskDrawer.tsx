import { CalendarDays, Copy, Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { AttachmentTypeIcon, formatFileSize } from '../../workspace/attachment-ui'
import { LabelChip } from './Chips'
import { EvidenceSourceQuote } from './Evidence'
import { PriorityGlyph, type TaskPriority } from './PriorityGlyph'
import { StateRing, type StateCategory } from './StateRing'
import { AssigneeAvatar, SurfaceState, type SurfaceStatus, type TaskAssignee } from './task-types'

export interface TaskDrawerData {
  key: string; board: string; title: string
  state: { category: StateCategory; name: string }
  assignee?: TaskAssignee; priority: TaskPriority; due?: { date: string; status?: 'default' | 'soon' | 'overdue' }
  labels?: Array<{ label: string; color: string }>
  subtasks?: Array<{ id: string; title: string; state: { category: StateCategory; name: string } }>
  references?: Array<{ id: string; filename: string; contentType: string; size: number; url?: string }>
  activity?: Array<{ id: string; text: string; state?: { category: StateCategory; name: string } }>
  comments?: Array<{ id: string; author: TaskAssignee; body: string; time: string }>
}

interface Props { task?: TaskDrawerData; status?: SurfaceStatus; sourceQuote?: ReactNode; onClose: () => void; onCopyLink: () => void; onEditProperty: (property: string) => void; onToggleSubtask: (id: string) => void; onAddSubtask: () => void; onSubmitComment: (body: string) => void; onRetry?: () => void }
const Section = ({ title, children }: { title: string; children: ReactNode }) => <section className="task-drawer-section"><header><span>{title}</span><i /></header>{children}</section>

export function TaskDrawer({ task, status = 'ready', sourceQuote, onClose, onCopyLink, onEditProperty, onToggleSubtask, onAddSubtask, onSubmitComment, onRetry }: Props) {
  if (status !== 'ready' || !task) return <aside aria-label="Task details" className="task-drawer"><SurfaceState status={status === 'ready' ? 'empty' : status} emptyMessage="Select a task to see its details." onRetry={onRetry} /></aside>
  const done = task.subtasks?.filter(item => item.state.category === 'completed').length ?? 0
  return <aside aria-label={`Task ${task.key}`} className="task-drawer">
    <header className="task-drawer-header"><StateRing category={task.state.category} label={task.state.name} /><code>{task.key} · {task.board}</code><span /><button aria-label="Copy task link" onClick={onCopyLink} title="Copy task link" type="button"><Copy size={16} /></button><button aria-label="Close task" onClick={onClose} title="Close task" type="button"><X size={17} /></button></header>
    <div className="task-drawer-content"><h2>{task.title}</h2><div aria-label="Task properties" className="task-property-row">
      <button onClick={() => onEditProperty('state')} type="button"><StateRing category={task.state.category} label={task.state.name} />{task.state.name}</button>
      <button onClick={() => onEditProperty('assignee')} type="button">{task.assignee ? <><AssigneeAvatar assignee={task.assignee} size={14} />{task.assignee.name}</> : 'Unassigned'}</button>
      <button onClick={() => onEditProperty('priority')} type="button"><PriorityGlyph priority={task.priority} />{task.priority}</button>
      {task.due ? <button onClick={() => onEditProperty('due')} type="button"><CalendarDays size={14} />{task.due.date}</button> : null}
      {task.labels?.map(item => <button key={item.label} onClick={() => onEditProperty(`label:${item.label}`)} type="button"><LabelChip {...item} /></button>)}
      <button aria-label="Add property" className="task-property-add" onClick={() => onEditProperty('add')} type="button"><Plus size={14} /></button>
    </div>
    {sourceQuote ? <Section title="Origin"><EvidenceSourceQuote>{sourceQuote}</EvidenceSourceQuote></Section> : null}
    <Section title={`Subtasks · ${done} of ${task.subtasks?.length ?? 0} done`}><div className="task-subtasks">{task.subtasks?.length ? task.subtasks.map(item => <button key={item.id} onClick={() => onToggleSubtask(item.id)} type="button"><StateRing category={item.state.category} label={item.state.name} size="subtask" /><span>{item.title}</span></button>) : <p>No subtasks yet.</p>}<button className="task-quiet-action" onClick={onAddSubtask} type="button"><Plus size={14} /> Add subtask</button></div></Section>
    <Section title="References"><div className="task-references">{task.references?.length ? task.references.map(ref => { const content = <><AttachmentTypeIcon contentType={ref.contentType} filename={ref.filename} size={18} /><span><strong>{ref.filename}</strong><small>{formatFileSize(ref.size)}</small></span></>; return ref.url ? <a href={ref.url} key={ref.id} rel="noreferrer" target="_blank">{content}</a> : <div key={ref.id}>{content}</div> }) : <p>No references linked.</p>}</div></Section>
    <Section title="Activity"><div className="task-activity">{task.activity?.map(item => <div className="task-system-item" key={item.id}>{item.state ? <StateRing category={item.state.category} label={item.state.name} size="dense" /> : null}{item.text}</div>)}{task.comments?.map(comment => <article key={comment.id}><AssigneeAvatar assignee={comment.author} size={24} /><div><strong>{comment.author.name} <time>{comment.time}</time></strong><p>{comment.body}</p></div></article>)}{!task.activity?.length && !task.comments?.length ? <p>No activity yet.</p> : null}<form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const body = String(form.get('comment') ?? '').trim(); if (body) onSubmitComment(body) }}><label className="task-visually-hidden" htmlFor={`comment-${task.key}`}>Add a comment</label><textarea id={`comment-${task.key}`} name="comment" placeholder="Add a comment…" required /><button type="submit">Comment</button></form></div></Section>
    </div></aside>
}
