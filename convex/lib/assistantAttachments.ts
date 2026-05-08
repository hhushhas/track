export const maxDocumentReaderAttachments = 4
export const maxDocumentReaderBytes = 18 * 1024 * 1024
export const maxImageAttachments = 4
export const maxImageBytes = 10 * 1024 * 1024

export type AssistantAttachmentSelectionCandidate = {
  contentType: string
  filename: string
  kind?: 'file' | 'voice_note'
  mode: 'document' | 'image'
  score: number
  size: number
  url: string | null
}

export function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function compactText(value: string, maxLength = 220) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trim()}...`
}

export function isImageAttachment(attachment: Pick<AssistantAttachmentSelectionCandidate, 'contentType'>) {
  return attachment.contentType.toLowerCase().startsWith('image/')
}

export function isDocumentReaderAttachment(
  attachment: Pick<AssistantAttachmentSelectionCandidate, 'contentType' | 'kind' | 'size' | 'url'>,
) {
  const contentType = attachment.contentType.toLowerCase()
  if (!attachment.url || attachment.kind === 'voice_note') return false
  if (contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/')) {
    return false
  }
  return attachment.size <= maxDocumentReaderBytes
}

export function attachmentNameMatchesQuestion(filename: string, question: string) {
  const normalizedQuestion = question.toLowerCase()
  const normalizedFilename = filename.toLowerCase()
  const stem = normalizedFilename.replace(/\.[^.]+$/, '')
  return (
    normalizedQuestion.includes(normalizedFilename) ||
    (stem.length >= 3 && normalizedQuestion.includes(stem))
  )
}

export function selectAttachmentCandidates<T extends AssistantAttachmentSelectionCandidate>(attachments: Array<T>) {
  const sorted = [...attachments].sort((left, right) => right.score - left.score)
  const documentAttachments = sorted
    .filter((attachment) => attachment.mode === 'document' && isDocumentReaderAttachment(attachment))
    .slice(0, maxDocumentReaderAttachments)
  const imageAttachments = sorted
    .filter((attachment) => attachment.mode === 'image' && attachment.url && attachment.size <= maxImageBytes)
    .slice(0, maxImageAttachments)
  return [...documentAttachments, ...imageAttachments]
}

export function attachmentReaderQuestion(question: string) {
  const cleaned = question.replace(/@track/gi, '').trim()
  if (cleaned) return cleaned
  return 'The user invoked Track Assistant for this message. Extract only project-relevant facts, tasks, decisions, blockers, dates, risks, requirements, or follow-ups from this file.'
}
