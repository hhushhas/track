import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { formatDateInputValue } from './task-date'
import type { TaskListItem } from './task-types'
import { PriorityPill, StateRing } from './ui/TaskVisuals'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const CALENDAR_EDGE_HOLD_MS = 4_000

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function moveCalendarMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthValue(new Date(year, monthNumber - 1 + offset, 1))
}

export function groupCalendarTasks<T extends { task: { dueDate?: string } }>(items: readonly T[]) {
  const byDate = new Map<string, T[]>()
  const unscheduled: T[] = []

  for (const item of items) {
    if (!item.task.dueDate) {
      unscheduled.push(item)
      continue
    }
    byDate.set(item.task.dueDate, [...(byDate.get(item.task.dueDate) ?? []), item])
  }

  return { byDate, unscheduled }
}

function CalendarTask({ draggable, item, onDragEnd, onDragStart, onOpen }: {
  draggable: boolean
  item: TaskListItem
  onDragEnd: () => void
  onDragStart: (item: TaskListItem) => void
  onOpen: (key: string) => void
}) {
  return (
    <button
      aria-describedby={draggable ? 'task-calendar-drag-help' : undefined}
      draggable={draggable}
      onClick={() => onOpen(item.task.publicKey)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        if (!draggable) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', item.task.publicKey)
        onDragStart(item)
      }}
      type="button"
    >
      <span><StateRing category={item.state?.category ?? 'backlog'} size="dense" /><strong>{item.task.title}</strong></span>
      <span><PriorityPill priority={item.task.priority} /> <small>{item.task.publicKey}</small></span>
    </button>
  )
}

export function TaskCalendarView({ canSchedule = () => false, items, month, onMonthChange, onOpen, onSchedule }: {
  items: TaskListItem[]
  month?: string
  onMonthChange: (month?: string) => void
  onOpen: (key: string) => void
  onSchedule: (item: TaskListItem, dueDate: string) => Promise<boolean>
  canSchedule?: (item: TaskListItem) => boolean
}) {
  const [expandedDate, setExpandedDate] = useState<string>()
  const [draggedTaskId, setDraggedTaskId] = useState<string>()
  const [dropDate, setDropDate] = useState<string>()
  const [edgeDirection, setEdgeDirection] = useState<-1 | 1>()
  const [optimisticDates, setOptimisticDates] = useState<Record<string, string>>({})
  const today = new Date()
  const activeMonth = month ?? monthValue(today)
  const [year, monthIndex] = activeMonth.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const gridStart = new Date(year, monthIndex - 1, 1 - first.getDay())
  const cells = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index))
  const displayItems = items.map((item) => optimisticDates[item.task._id]
    ? { ...item, task: { ...item.task, dueDate: optimisticDates[item.task._id] } }
    : item)
  const { byDate, unscheduled } = groupCalendarTasks(displayItems)
  const move = (offset: number) => onMonthChange(moveCalendarMonth(activeMonth, offset))
  const fullDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' })

  useEffect(() => {
    if (!draggedTaskId || !edgeDirection) return
    const timer = window.setTimeout(
      () => onMonthChange(moveCalendarMonth(activeMonth, edgeDirection)),
      CALENDAR_EDGE_HOLD_MS,
    )
    return () => window.clearTimeout(timer)
  }, [activeMonth, draggedTaskId, edgeDirection, onMonthChange])

  useEffect(() => {
    setOptimisticDates((current) => {
      const next = { ...current }
      let changed = false
      for (const item of items) {
        if (next[item.task._id] && next[item.task._id] === item.task.dueDate) {
          delete next[item.task._id]
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [items])

  function finishDrag() {
    setDraggedTaskId(undefined)
    setDropDate(undefined)
    setEdgeDirection(undefined)
  }

  async function schedule(date: string) {
    const item = items.find((candidate) => candidate.task._id === draggedTaskId)
    finishDrag()
    if (!item || item.task.dueDate === date || !canSchedule(item)) return

    setOptimisticDates((current) => ({ ...current, [item.task._id]: date }))
    if (await onSchedule(item, date)) return
    setOptimisticDates((current) => {
      const next = { ...current }
      delete next[item.task._id]
      return next
    })
  }

  return (
    <section aria-label="Task calendar" className="task-calendar">
      <p className="sr-only" id="task-calendar-drag-help">Drag this task onto a calendar date to update its due date. Hold it at either calendar edge for four seconds to change months.</p>
      <header>
        <div>
          <Button aria-label="Previous month" onClick={() => move(-1)} size="icon" variant="outline"><ChevronLeft size={18} /></Button>
          <Button aria-label="Next month" onClick={() => move(1)} size="icon" variant="outline"><ChevronRight size={18} /></Button>
          <span className="task-calendar-title"><h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><small>Drag a task to schedule it</small></span>
        </div>
        <Button onClick={() => onMonthChange(undefined)} variant="outline">Today</Button>
      </header>
      {unscheduled.length ? (
        <section aria-label={`${unscheduled.length} unscheduled tasks`} className="task-calendar-unscheduled">
          <header><span className="task-calendar-unscheduled-icon"><CalendarClock aria-hidden="true" size={16} /></span><span><strong>Unscheduled</strong><small>{unscheduled.length} {unscheduled.length === 1 ? 'task has' : 'tasks have'} no due date</small></span></header>
          <div>{unscheduled.map((item) => <CalendarTask draggable={canSchedule(item)} item={item} key={item.task._id} onDragEnd={finishDrag} onDragStart={(task) => setDraggedTaskId(task.task._id)} onOpen={onOpen} />)}</div>
        </section>
      ) : null}
      <div className="task-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="task-calendar-grid">{cells.map((date) => {
        const key = formatDateInputValue(date)
        const dayItems = byDate.get(key) ?? []
        const outside = date.getMonth() !== monthIndex - 1
        const expanded = expandedDate === key
        return (
          <div
            aria-label={`${fullDateFormatter.format(date)}${draggedTaskId ? '. Drop to schedule task.' : ''}`}
            className={`task-calendar-day${outside ? ' outside' : ''}${key === formatDateInputValue(today) ? ' today' : ''}${dropDate === key ? ' is-drop-target' : ''}`}
            key={key}
            onDragEnter={() => {
              if (draggedTaskId) {
                setDropDate(key)
                setEdgeDirection(undefined)
              }
            }}
            onDragOver={(event) => {
              if (draggedTaskId) {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              void schedule(key)
            }}
            role="group"
          >
            <span aria-hidden="true" className="task-calendar-number">{date.getDate()}</span>
            <div className="task-calendar-events">
              {dayItems.slice(0, expanded ? dayItems.length : 2).map((item) => <CalendarTask draggable={canSchedule(item)} item={item} key={item.task._id} onDragEnd={finishDrag} onDragStart={(task) => setDraggedTaskId(task.task._id)} onOpen={onOpen} />)}
              {dayItems.length > 2 ? <button aria-expanded={expanded} className="task-calendar-more" onClick={() => setExpandedDate(expanded ? undefined : key)} type="button">{expanded ? 'Show less' : `+${dayItems.length - 2} more`}</button> : null}
            </div>
          </div>
        )
      })}</div>
      {draggedTaskId ? (
        <>
          <div aria-label="Hold for previous month" className={`task-calendar-edge is-left${edgeDirection === -1 ? ' is-active' : ''}`} onDragEnter={() => { setDropDate(undefined); setEdgeDirection(-1) }} onDragOver={(event) => event.preventDefault()}><ChevronLeft aria-hidden="true" size={18} /><span>Hold for previous month</span></div>
          <div aria-label="Hold for next month" className={`task-calendar-edge is-right${edgeDirection === 1 ? ' is-active' : ''}`} onDragEnter={() => { setDropDate(undefined); setEdgeDirection(1) }} onDragOver={(event) => event.preventDefault()}><span>Hold for next month</span><ChevronRight aria-hidden="true" size={18} /></div>
        </>
      ) : null}
    </section>
  )
}
