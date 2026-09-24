import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import type { TaskListItem } from './task-types'
import { formatTaskCommentCount, formatTaskDateLong, PriorityPill, StateBadge, TaskAvatar, TaskLabelPill } from './ui/TaskVisuals'

const pageSizes = [10, 25, 50]

export function TaskListView({ items, onOpen }: { items: TaskListItem[]; onOpen: (key: string) => void }) {
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const sorted = useMemo(() => [...items].sort((a, b) => a.task.rank.localeCompare(b.task.rank)), [items])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.task._id))
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return <section aria-label="Task list" className="task-table-shell">
    {selected.size ? <div className="task-bulk-bar" role="status"><strong>{selected.size} selected</strong><span>Open a task to change its status, assignee, due date, or archive state.</span><Button onClick={() => setSelected(new Set())} size="sm" variant="ghost">Clear</Button></div> : null}
    <div className="task-table-scroll"><table className="task-table">
      <thead><tr>
        <th><input aria-label="Select visible tasks" checked={allVisibleSelected} onChange={() => setSelected((current) => {
          const next = new Set(current)
          for (const item of visible) {
            if (allVisibleSelected) next.delete(item.task._id)
            else next.add(item.task._id)
          }
          return next
        })} type="checkbox" /></th>
        <th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due date</th><th>Label</th><th>Comments</th><th><span className="sr-only">Actions</span></th>
      </tr></thead>
      <tbody>{visible.map((item) => <tr key={item.task._id}>
        <td><input aria-label={`Select ${item.task.title}`} checked={selected.has(item.task._id)} onChange={() => toggle(item.task._id)} type="checkbox" /></td>
        <td><button className="task-table-title" onClick={() => onOpen(item.task.publicKey)} type="button"><strong>{item.task.title}</strong><span>{item.task.publicKey}</span></button></td>
        <td><StateBadge state={item.state} /></td>
        <td><PriorityPill priority={item.task.priority} /></td>
        <td><TaskAvatar member={item.assignee} size="table" /></td>
        <td>{item.task.dueDate ? <span className="task-table-date"><CalendarDays aria-hidden="true" size={15} />{formatTaskDateLong(item.task.dueDate)}</span> : <span className="task-muted">No date</span>}</td>
        <td><TaskLabelPill labels={item.labels} /></td>
        <td><span aria-label={`${item.commentCount >= 101 ? 'More than 100' : item.commentCount} comments`} className="task-comment-count"><MessageCircle aria-hidden="true" size={15} />{formatTaskCommentCount(item.commentCount)}</span></td>
        <td><Button aria-label={`Open ${item.task.title}`} onClick={() => onOpen(item.task.publicKey)} size="icon-sm" variant="ghost"><MoreHorizontal aria-hidden="true" size={16} /></Button></td>
      </tr>)}</tbody>
    </table></div>
    <footer className="task-table-footer"><span>{sorted.length} task{sorted.length === 1 ? '' : 's'}</span><label>Rows per page <select onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }} value={pageSize}>{pageSizes.map((size) => <option key={size}>{size}</option>)}</select></label><span>{sorted.length ? `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} of ${sorted.length}` : '0 of 0'}</span><Button aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} size="icon-sm" variant="ghost"><ChevronLeft size={16} /></Button><Button aria-label="Next page" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} size="icon-sm" variant="ghost"><ChevronRight size={16} /></Button></footer>
  </section>
}
