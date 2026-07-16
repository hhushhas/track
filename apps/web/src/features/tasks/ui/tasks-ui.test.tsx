import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DueChip, EvidenceFooter, EvidenceSourceQuote, LabelChip, MetadataChip, PriorityGlyph, StateRing } from '.'
import type { DueStatus, StateCategory, StateRingSize, TaskPriority } from '.'

const states: Array<{ category: StateCategory; label: string }> = [
  { category: 'backlog', label: 'Backlog' },
  { category: 'unstarted', label: 'To do' },
  { category: 'started', label: 'In progress' },
  { category: 'completed', label: 'Done' },
  { category: 'canceled', label: 'Canceled' },
]
const priorities: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent']
const priorityLabels = ['No priority', 'Low priority', 'Medium priority', 'High priority', 'Urgent']
const dueStates: Array<{ status: DueStatus; expected: string }> = [
  { status: 'default', expected: 'Due Jul 24' },
  { status: 'soon', expected: 'Due Jul 24' },
  { status: 'overdue', expected: 'Due Jul 24 · overdue' },
]

describe('StateRing', () => {
  it.each(states)('renders the $category category with a free-text accessible label', ({ category, label }) => {
    render(<StateRing category={category} label={label} />)
    const glyph = screen.getByRole('img', { name: label })
    expect(glyph.querySelector('[aria-hidden="true"]')?.getAttribute('data-category')).toBe(category)
  })

  it.each<[StateRingSize, string]>([['dense', '12px'], ['subtask', '13px'], ['default', '14px']])('renders the %s size', (size, pixels) => {
    const { container } = render(<StateRing category="started" label="Working" size={size} />)
    expect(container.querySelector<HTMLElement>('.task-state-ring')?.style.getPropertyValue('--state-ring-size')).toBe(pixels)
  })
})

describe('PriorityGlyph', () => {
  it.each(priorities.map((priority, index) => [priority, priorityLabels[index]] as const))('labels the %s glyph as %s', (priority, label) => {
    render(<PriorityGlyph priority={priority} />)
    expect(screen.getByRole('img', { name: label }).getAttribute('title')).toBe(label)
  })

  it('always shows the urgent text and can show another priority text', () => {
    const { container, rerender } = render(<PriorityGlyph priority="urgent" />)
    expect(container.querySelector('.task-priority-label')?.textContent).toBe('Urgent')
    rerender(<PriorityGlyph priority="low" showLabel />)
    expect(container.querySelector('.task-priority-label')?.textContent).toBe('Low priority')
  })
})

describe('task chips', () => {
  it.each(dueStates)('renders an accessible $status due state', ({ status, expected }) => {
    const { container } = render(<DueChip date="Jul 24" status={status} />)
    const chip = container.querySelector('.task-due-chip')
    expect(chip?.getAttribute('aria-label')).toBe(expected)
    if (status === 'overdue') expect(chip?.textContent).toContain('overdue')
  })

  it('renders metadata and sentence-case label content', () => {
    render(<><MetadataChip leading={<span>AM</span>}>Ada</MetadataChip><LabelChip color="var(--info)" label="Customer feedback" /></>)
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.getByText('Customer feedback')).toBeTruthy()
  })
})

describe('evidence primitives', () => {
  it('exposes footer activation to assistive technology', () => {
    const activate = vi.fn()
    render(<EvidenceFooter caption="Created from this message · Launch" onActivate={activate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Created from this message · Launch' }))
    expect(activate).toHaveBeenCalledOnce()
  })

  it('integrates a reusable source quote with a labeled connector', () => {
    render(<EvidenceSourceQuote><button type="button">Jump to message</button></EvidenceSourceQuote>)
    expect(screen.getByRole('region', { name: 'Source message' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Connection to source message' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jump to message' })).toBeTruthy()
  })
})
