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
  const titleId = useId()
  const descriptionId = useId()

  async function confirm() {
    if (pending) return
    setPending(true)
    try {
      const result = await onConfirm()
      if (result !== false) onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={descriptionId} aria-labelledby={titleId}>
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogDescription id={descriptionId}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void confirm()} type="button" variant={destructive ? 'destructive' : 'default'}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
