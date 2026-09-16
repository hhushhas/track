import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatePicker } from './date-picker'

afterEach(cleanup)

describe('DatePicker', () => {
  it('moves the roving date focus with calendar keys and selects the focused day', async () => {
    const onChange = vi.fn()

    render(<DatePicker aria-label="Due date" onChange={onChange} value="2026-09-11" />)
    fireEvent.click(screen.getByRole('button', { name: 'Due date' }))

    const selectedDay = screen.getByRole('gridcell', { name: /September 11, 2026/i })
    expect(selectedDay.getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(selectedDay, { key: 'ArrowRight' })
    const nextDay = screen.getByRole('gridcell', { name: /September 12, 2026/i })
    await waitFor(() => expect(nextDay.getAttribute('tabindex')).toBe('0'))
    expect(document.activeElement).toBe(nextDay)

    fireEvent.keyDown(nextDay, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2026-09-12')
    expect(screen.getByRole('status').textContent).toMatch(/Selected Sep 12, 2026/i)
  })

  it('keeps an accessible month grid and supports clearing a selected date', () => {
    const onChange = vi.fn()

    render(<DatePicker aria-label="Due date" onChange={onChange} value="2026-09-11" />)
    fireEvent.click(screen.getByRole('button', { name: 'Due date' }))

    expect(screen.getByRole('grid', { name: /September 2026/i })).toBeTruthy()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.getByRole('status').textContent).toBe('Date cleared')
  })
})
