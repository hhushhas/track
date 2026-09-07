export type MessageSendAttempt<TMessageId, TUploadedAttachment> = {
  assistantCompleted: boolean
  attachedPendingIds: Set<string>
  idempotencyKey: string
  messageId: TMessageId | null
  signature: string
  uploadedByPendingId: Map<string, { value: TUploadedAttachment }>
}

export function createMessageSendAttempt<TMessageId, TUploadedAttachment>(
  signature: string,
  idempotencyKey: string,
): MessageSendAttempt<TMessageId, TUploadedAttachment> {
  return {
    assistantCompleted: false,
    attachedPendingIds: new Set(),
    idempotencyKey,
    messageId: null,
    signature,
    uploadedByPendingId: new Map(),
  }
}

export async function runMessageSendAttempt<TPendingAttachment extends { id: string }, TMessageId, TUploadedAttachment>({
  askAssistant,
  attach,
  attempt,
  pendingAttachments,
  send,
  upload,
}: {
  askAssistant?: (messageId: TMessageId) => Promise<void>
  attach: (messageId: TMessageId, uploaded: TUploadedAttachment) => Promise<void>
  attempt: MessageSendAttempt<TMessageId, TUploadedAttachment>
  pendingAttachments: Array<TPendingAttachment>
  send: (idempotencyKey: string) => Promise<TMessageId>
  upload: (pendingAttachment: TPendingAttachment) => Promise<TUploadedAttachment>
}) {
  const uploadedAttachments: Array<{ id: string; value: TUploadedAttachment }> = []
  for (const pendingAttachment of pendingAttachments) {
    let uploaded = attempt.uploadedByPendingId.get(pendingAttachment.id)
    if (!uploaded) {
      uploaded = { value: await upload(pendingAttachment) }
      attempt.uploadedByPendingId.set(pendingAttachment.id, uploaded)
    }
    uploadedAttachments.push({ id: pendingAttachment.id, value: uploaded.value })
  }

  if (attempt.messageId === null) {
    attempt.messageId = await send(attempt.idempotencyKey)
  }
  for (const uploaded of uploadedAttachments) {
    if (attempt.attachedPendingIds.has(uploaded.id)) continue
    await attach(attempt.messageId, uploaded.value)
    attempt.attachedPendingIds.add(uploaded.id)
  }

  let assistantError: unknown | null = null
  if (askAssistant && !attempt.assistantCompleted) {
    try {
      await askAssistant(attempt.messageId)
      attempt.assistantCompleted = true
    } catch (error) {
      assistantError = error
    }
  }

  return { assistantError, messageId: attempt.messageId }
}
