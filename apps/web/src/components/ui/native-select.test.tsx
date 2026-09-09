import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NativeSelect, NativeSelectOption } from './native-select'

describe('NativeSelect compatibility adapter', () => {
  it('uses the shared project-filter select and preserves option labels', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <form>
        <NativeSelect aria-label="Assignee" name="assignee" onChange={(event) => onChange(event.target.value)} required value="">
          <NativeSelectOption value="">Unassigned</NativeSelectOption>
          <NativeSelectOption value="member-1">Sam</NativeSelectOption>
        </NativeSelect>
      </form>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Assignee' })
    expect(trigger.className).toContain('task-filter-select')
    expect(trigger.className).toContain('data-[size=default]:h-9')
    expect(trigger.textContent).toContain('Unassigned')

    fireEvent.click(trigger)
    const option = await screen.findByRole('option', { name: 'Sam' })
    fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' })
    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith('member-1')

    const formInput = container.querySelector<HTMLInputElement>('input[name="assignee"]')
    expect(formInput?.value).toBe('')
    expect(formInput?.required).toBe(true)
  })
})
