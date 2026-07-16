import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChannelHeaderTabs, ChannelRailSections, TaskDrawer, type TaskDrawerData } from '.'

const task: TaskDrawerData = { key: 'T-7K4M2P9Q', board: 'Launch', title: 'Prepare launch', state: { category: 'started', name: 'In progress' }, assignee: { name: 'Ada' }, priority: 'high', due: { date: 'Jul 24' }, labels: [{ label: 'Website', color: 'var(--accent)' }], subtasks: [{ id: 's1', title: 'Review copy', state: { category: 'completed', name: 'Done' } }], references: [{ id: 'r1', filename: 'brief.pdf', contentType: 'application/pdf', size: 2000 }], activity: [{ id: 'a1', text: 'Ada changed status', state: { category: 'started', name: 'In progress' } }], comments: [{ id: 'c1', author: { name: 'Bo' }, body: 'Ready to review', time: '10:00' }] }
afterEach(cleanup)
describe('TaskDrawer', () => { it('offers working property, subtask, header, and comment controls', () => { const edit = vi.fn(), toggle = vi.fn(), submit = vi.fn(), close = vi.fn(); render(<TaskDrawer task={task} sourceQuote={<button type="button">Jump to message</button>} onAddSubtask={vi.fn()} onClose={close} onCopyLink={vi.fn()} onEditProperty={edit} onSubmitComment={submit} onToggleSubtask={toggle} />); fireEvent.click(screen.getByRole('button', { name: /In progress/ })); fireEvent.click(screen.getByRole('button', { name: /Review copy/ })); fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Looks good' } }); fireEvent.click(screen.getByRole('button', { name: 'Comment' })); fireEvent.click(screen.getByRole('button', { name: 'Close task' })); expect(edit).toHaveBeenCalledWith('state'); expect(toggle).toHaveBeenCalledWith('s1'); expect(submit).toHaveBeenCalledWith('Looks good'); expect(close).toHaveBeenCalledOnce() }); it('renders error retry', () => { const retry = vi.fn(); render(<TaskDrawer status="error" onAddSubtask={vi.fn()} onClose={vi.fn()} onCopyLink={vi.fn()} onEditProperty={vi.fn()} onSubmitComment={vi.fn()} onToggleSubtask={vi.fn()} onRetry={retry} />); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledOnce() }) })
describe('channel task presentation', () => {
  it('changes tabs and opens task/thread rows', () => {
    const action = vi.fn()
    render(<><ChannelHeaderTabs active="conversation" openTaskCount={1} onChange={action} panelIds={{ conversation: 'conversation-panel', board: 'board-panel' }} /><div aria-labelledby="channel-conversation-tab" id="conversation-panel" role="tabpanel" /><div aria-labelledby="channel-board-tab" id="board-panel" role="tabpanel" /><ChannelRailSections tasks={[{ ...task, key: task.key, priority: 'high' }]} threads={[{ id: 'th1', title: 'Press kit', meta: '2 replies' }]} onOpenTask={action} onOpenThread={action} /></>)
    fireEvent.click(screen.getByRole('tab', { name: /Board/ }))
    fireEvent.click(screen.getByRole('button', { name: /Prepare launch/ }))
    fireEvent.click(screen.getByRole('button', { name: /Press kit/ }))
    expect(action.mock.calls).toEqual([['board'], [task.key], ['th1']])
  })

  it('uses roving focus and keyboard selection for the Channel tabs', () => {
    const action = vi.fn()
    const { container } = render(<ChannelHeaderTabs active="conversation" openTaskCount={2} onChange={action} panelIds={{ conversation: 'conversation-panel', board: 'board-panel' }} />)
    const conversation = container.querySelector<HTMLButtonElement>('#channel-conversation-tab')!
    const board = container.querySelector<HTMLButtonElement>('#channel-board-tab')!
    expect(conversation.tabIndex).toBe(0)
    expect(board.tabIndex).toBe(-1)
    conversation.focus()
    fireEvent.keyDown(conversation, { key: 'ArrowRight' })
    expect(action).toHaveBeenLastCalledWith('board')
    expect(document.activeElement).toBe(board)
    fireEvent.keyDown(board, { key: 'Home' })
    expect(action).toHaveBeenLastCalledWith('conversation')
    expect(document.activeElement).toBe(conversation)
    expect(board.getAttribute('aria-controls')).toBe('board-panel')
  })
})
