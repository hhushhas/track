import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet'

describe('Sheet', () => {
  it('provides the shared Track drawer anatomy and closes accessibly', () => {
    const onOpenChange = vi.fn()

    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Task details</SheetTitle>
            <SheetDescription>Review and update this task.</SheetDescription>
          </SheetHeader>
          <SheetBody>Drawer content</SheetBody>
          <SheetFooter>Drawer actions</SheetFooter>
        </SheetContent>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    expect(dialog.classList.contains('track-drawer')).toBe(true)
    expect(dialog.querySelector('[data-slot="sheet-header"]')?.classList.contains('track-drawer-header')).toBe(true)
    expect(dialog.querySelector('[data-slot="sheet-body"]')?.classList.contains('track-drawer-body')).toBe(true)
    expect(dialog.querySelector('[data-slot="sheet-footer"]')?.classList.contains('track-drawer-footer')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false)
  })
})
