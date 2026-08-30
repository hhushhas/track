import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MessageAttachmentList, type MessageAttachmentItem } from './message-attachment-list'

function attachment({
  contentType,
  filename,
  id,
  kind,
  size,
  url,
}: {
  contentType: string
  filename: string
  id: string
  kind?: MessageAttachmentItem['attachment']['kind']
  size: number
  url: string | null
}): MessageAttachmentItem {
  return {
    attachment: { _id: id, contentType, filename, kind, size },
    url,
  }
}

describe('MessageAttachmentList', () => {
  it('renders signed image links and native file metadata', () => {
    render(
      <MessageAttachmentList
        attachments={[
          attachment({
            contentType: 'image/png',
            filename: 'campaign-board.png',
            id: 'image-attachment',
            size: 2048,
            url: 'https://storage.example/campaign-board.png?signature=demo',
          }),
          attachment({
            contentType: 'application/pdf',
            filename: 'approval-brief.pdf',
            id: 'pdf-attachment',
            size: 4096,
            url: null,
          }),
        ]}
      />,
    )

    const image = screen.getByRole('img', { name: 'campaign-board.png' })
    expect(image.getAttribute('src')).toBe('https://storage.example/campaign-board.png?signature=demo')
    expect(screen.getByRole('link').getAttribute('target')).toBe('_blank')
    expect(screen.getByText('approval-brief.pdf')).not.toBeNull()
    expect(screen.getByLabelText('PDF')).not.toBeNull()
  })

  it('keeps voice-note semantics when a signed URL is unavailable', () => {
    render(
      <MessageAttachmentList
        attachments={[
          attachment({
            contentType: 'audio/wav',
            filename: 'voice-note.wav',
            id: 'voice-attachment',
            kind: 'voice_note',
            size: 8192,
            url: null,
          }),
        ]}
      />,
    )

    expect(screen.getByText('Voice note')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Play voice note' }).getAttribute('disabled')).not.toBeNull()
  })
})
