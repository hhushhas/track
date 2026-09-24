import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TaskListItem } from './task-types'
import { CALENDAR_EDGE_HOLD_MS, groupCalendarTasks, moveCalendarMonth, TaskCalendarView } from './TaskCalendarView'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const task = {
  task: {
    _id: 'task-1',
    publicKey: 'COM-1243',
    title: 'Clarify scope',
    priority: 'high',
    revision: 1,
    dueDate: undefined,
  },
  state: { category: 'unstarted' },
} as unknown as TaskListItem

const dataTransfer = {
  dropEffect: 'none',
  effectAllowed: 'none',
  setData: vi.fn(),
}

describe('task calendar', () => {
  it('keeps undated tasks visible as unscheduled work', () => {
    const scheduled = { task: { dueDate: '2026-09-18', title: 'Review policy documents' } }
    const unscheduled = { task: { dueDate: undefined, title: 'Clarify scope' } }

    const groups = groupCalendarTasks([scheduled, unscheduled])

    expect(groups.byDate.get('2026-09-18')).toEqual([scheduled])
    expect(groups.unscheduled).toEqual([unscheduled])
  })

  it('moves across year boundaries without changing date semantics', () => {
    expect(moveCalendarMonth('2026-12', 1)).toBe('2027-01')
    expect(moveCalendarMonth('2026-01', -1)).toBe('2025-12')
  })

  it('schedules an editable task when it is dropped on a date', async () => {
    const onSchedule = vi.fn().mockResolvedValue(true)
    render(<TaskCalendarView canSchedule={() => true} items={[task]} month="2026-09" onMonthChange={() => undefined} onOpen={() => undefined} onSchedule={onSchedule} />)

    fireEvent.dragStart(screen.getByRole('button', { name: /Clarify scope/ }), { dataTransfer })
    const date = screen.getByRole('group', { name: /September 18, 2026/ })
    fireEvent.dragEnter(date)
    fireEvent.drop(date, { dataTransfer })

    expect(onSchedule).toHaveBeenCalledWith(task, '2026-09-18')
  })

  it('advances every four seconds while a task remains at the right edge', () => {
    vi.useFakeTimers()
    const changes = vi.fn()

    function Harness() {
      const [month, setMonth] = useState('2026-09')
      return <TaskCalendarView
        canSchedule={() => true}
        items={[task]}
        month={month}
        onMonthChange={(next) => {
          if (next) setMonth(next)
          changes(next)
        }}
        onOpen={() => undefined}
        onSchedule={async () => true}
      />
    }

    render(<Harness />)
    fireEvent.dragStart(screen.getByRole('button', { name: /Clarify scope/ }), { dataTransfer })
    fireEvent.dragEnter(screen.getByLabelText('Hold for next month'))

    act(() => vi.advanceTimersByTime(CALENDAR_EDGE_HOLD_MS))
    expect(changes).toHaveBeenLastCalledWith('2026-10')
    act(() => vi.advanceTimersByTime(CALENDAR_EDGE_HOLD_MS))
    expect(changes).toHaveBeenLastCalledWith('2026-11')
  })
})
