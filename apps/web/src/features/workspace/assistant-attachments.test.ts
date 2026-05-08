import { describe, expect, it } from 'vitest'

import {
  attachmentReaderQuestion,
  maxDocumentReaderBytes,
  maxImageBytes,
  selectAttachmentCandidates,
} from '../../../../../convex/lib/assistantAttachments'

describe('assistant attachment selection', () => {
  it('routes documents to the reader and images to the final model', () => {
    const selected = selectAttachmentCandidates([
      {
        contentType: 'application/pdf',
        filename: 'proposal.pdf',
        mode: 'document',
        score: 120,
        size: 200_000,
        url: 'https://files.local/proposal.pdf',
      },
      {
        contentType: 'image/png',
        filename: 'screenshot.png',
        mode: 'image',
        score: 110,
        size: 300_000,
        url: 'https://files.local/screenshot.png',
      },
      {
        contentType: 'audio/webm',
        filename: 'voice-note.webm',
        kind: 'voice_note',
        mode: 'document',
        score: 200,
        size: 50_000,
        url: 'https://files.local/voice-note.webm',
      },
      {
        contentType: 'application/pdf',
        filename: 'too-large.pdf',
        mode: 'document',
        score: 130,
        size: maxDocumentReaderBytes + 1,
        url: 'https://files.local/too-large.pdf',
      },
      {
        contentType: 'image/jpeg',
        filename: 'huge-photo.jpg',
        mode: 'image',
        score: 130,
        size: maxImageBytes + 1,
        url: 'https://files.local/huge-photo.jpg',
      },
    ])

    expect(selected.map((attachment) => attachment.filename)).toEqual(['proposal.pdf', 'screenshot.png'])
  })

  it('passes the actual user query to the document reader when one exists', () => {
    expect(attachmentReaderQuestion('@track what payment dates are in this proposal?')).toBe(
      'what payment dates are in this proposal?',
    )
  })

  it('falls back to project-relevant extraction when the invocation has no query', () => {
    expect(attachmentReaderQuestion('@track')).toContain('Extract only project-relevant facts')
  })
})
