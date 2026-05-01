import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, RefObject } from 'react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { createPendingAttachment } from '#/features/workspace/attachments/pending-attachments'

export type PendingWorkspaceAttachment = ReturnType<typeof createPendingAttachment>

export function usePendingAttachments({
  activeGroupId,
  composerRef,
  onAfterAdd,
}: {
  activeGroupId: Id<'groups'> | null
  composerRef: RefObject<HTMLTextAreaElement | null>
  onAfterAdd: () => void
}) {
  const [pendingAttachments, setPendingAttachments] = useState<Array<PendingWorkspaceAttachment>>([])
  const pendingAttachmentsRef = useRef<Array<PendingWorkspaceAttachment>>([])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

  useEffect(() => {
    return () => {
      revokeAttachmentPreviews(pendingAttachmentsRef.current)
    }
  }, [])

  function focusComposerAfterAdd() {
    onAfterAdd()
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function addPendingAttachments(files: Array<File>) {
    setPendingAttachments((attachments) => [
      ...attachments,
      ...files.map((file) => createPendingAttachment(file)),
    ])
    focusComposerAfterAdd()
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0 || !activeGroupId) return
    addPendingAttachments(files)
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!activeGroupId) return
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    addPendingAttachments(files)
  }

  function handleVoiceNoteRecorded(recording: { file: File; durationMs: number; previewUrl: string }) {
    setPendingAttachments((attachments) => [
      ...attachments,
      createPendingAttachment(recording.file, {
        durationMs: recording.durationMs,
        kind: 'voice_note',
        previewUrl: recording.previewUrl,
      }),
    ])
    focusComposerAfterAdd()
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((attachments) => {
      const attachment = attachments.find((item) => item.id === id)
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      return attachments.filter((item) => item.id !== id)
    })
  }

  function clearPendingAttachments() {
    setPendingAttachments((attachments) => {
      revokeAttachmentPreviews(attachments)
      return []
    })
  }

  return {
    clearPendingAttachments,
    handleComposerPaste,
    handleFileSelected,
    handleVoiceNoteRecorded,
    pendingAttachments,
    removePendingAttachment,
  }
}

function revokeAttachmentPreviews(attachments: Array<PendingWorkspaceAttachment>) {
  for (const attachment of attachments) {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
  }
}
