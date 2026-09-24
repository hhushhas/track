import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  it('confirms and closes after a successful action', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(
      <ConfirmDialog
        description="This action cannot be undone."
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        title="Delete this item?"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the dialog open when the action reports a recoverable failure', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false)
    const onOpenChange = vi.fn()

    render(
      <ConfirmDialog
        confirmLabel="Delete"
        description="This action cannot be undone."
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        title="Delete this item?"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
