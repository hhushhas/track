import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BoardHeader, InlineTaskCard, SuggestionInbox, TaskBoard, TaskList } from '.'
import type { TaskGroup, TaskPresentation } from '.'

const task: TaskPresentation = { key: 'T-7K4M2P9Q', title: 'Prepare launch notes that truncate safely', state: { category: 'started', name: 'In progress' }, assignee: { name: 'Ada May' }, due: { date: 'Jul 24', status: 'soon' }, priority: 'high', origin: '#launch-plan · today', subtaskProgress: '1/3' }
const groups: TaskGroup[] = [{ id: 'started', name: 'In progress', category: 'started', tasks: [task] }]

describe('InlineTaskCard', () => {
  it('renders an opaque key and opens from the card and evidence footer', () => {
    const open = vi.fn()
    render(<InlineTaskCard evidenceCaption="Created from this message · Launch" task={task} onOpen={open} />)
    fireEvent.click(screen.getByRole('button', { name: /Open task T-7K4M2P9Q/ }))
    fireEvent.click(screen.getByRole('button', { name: /Created from this message/ }))
    expect(open).toHaveBeenNthCalledWith(1, task.key)
    expect(open).toHaveBeenNthCalledWith(2, task.key)
  })
})

describe('board presentation', () => {
  it('supports view, filter, new task, task open and column add actions', () => {
    const action = vi.fn()
    const { container } = render(<><BoardHeader name="Launch" scope="Project" view="board" onFilter={action} onNewTask={action} onViewChange={action} /><TaskBoard columns={[{ id: 'doing', name: 'In progress', category: 'started', tasks: [task] }]} onAddTask={action} onOpenTask={action} /></>)
    const view = within(container)
    fireEvent.click(view.getByRole('button', { name: 'List' }))
    fireEvent.click(view.getByRole('button', { name: /Open task/ }))
    fireEvent.click(view.getByRole('button', { name: 'Add task to In progress' }))
    expect(action).toHaveBeenCalledWith('list')
    expect(action).toHaveBeenCalledWith(task.key)
    expect(action).toHaveBeenCalledWith('doing')
  })

  it('provides actionable suggestion decisions', () => {
    const accept = vi.fn(); const dismiss = vi.fn()
    render(<SuggestionInbox suggestions={[{ id: 's1', title: 'Draft release', source: '#launch · today' }]} onAccept={accept} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' })); fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(accept).toHaveBeenCalledWith('s1'); expect(dismiss).toHaveBeenCalledWith('s1')
  })
})

describe('shared task list', () => {
  it('uses the same rows for all and My tasks while omitting assignee in My tasks', () => {
    const { container, rerender } = render(<TaskList groups={groups} onOpenTask={vi.fn()} />)
    expect(within(container).getByText('Assigned to Ada May')).toBeTruthy()
    rerender(<TaskList groups={groups} mode="my-tasks" onOpenTask={vi.fn()} />)
    expect(within(container).queryByText('Assigned to Ada May')).toBeNull()
  })

  it.each(['loading', 'empty'] as const)('renders the %s state', status => {
    render(<TaskList groups={[]} status={status} onOpenTask={vi.fn()} />)
    expect(status === 'loading' ? screen.getByLabelText('Loading tasks') : screen.getByText('No tasks match this view.')).toBeTruthy()
  })

  it('renders an error with retry', () => {
    const retry = vi.fn(); render(<TaskBoard columns={[]} status="error" onAddTask={vi.fn()} onOpenTask={vi.fn()} onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledOnce()
  })
})
