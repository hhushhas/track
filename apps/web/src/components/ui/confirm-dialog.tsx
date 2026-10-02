import { useId, useState } from 'react'

import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

type ConfirmDialogProps = {
  confirmLabel?: string
  description: string
  onConfirm: () => void | boolean | Promise<void | boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
  destructive?: boolean
}

/**
 * The single confirmation contract for irreversible or audience-changing actions.
 * Returning false keeps the dialog open so callers can show a server failure inline.
 */
export function ConfirmDialog({
  confirmLabel = 'Confirm',
  description,
  destructive = true,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  function handleOpenChange(nextOpen: boolean) {
    if (pending && !nextOpen) return
    if (!nextOpen) setError(null)
    onOpenChange(nextOpen)
  }

  async function confirm() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const result = await onConfirm()
      if (result !== false) {
        setError(null)
        onOpenChange(false)
      }
    } catch {
      setError('This action could not be completed. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent aria-busy={pending} aria-describedby={descriptionId} aria-labelledby={titleId} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogDescription id={descriptionId}>{description}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button disabled={pending} onClick={() => handleOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button aria-busy={pending} disabled={pending} onClick={() => void confirm()} type="button" variant={destructive ? 'destructive' : 'default'}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
