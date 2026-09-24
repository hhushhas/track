import { describe, expect, it } from 'vitest'

import { formatCopiedAttachmentCount, formatMessageTime } from './message-presentation'

describe('message presentation', () => {
  it('formats attachment counts with the correct noun', () => {
    expect(formatCopiedAttachmentCount(1)).toBe('1 attachment copied')
    expect(formatCopiedAttachmentCount(2)).toBe('2 attachments copied')
  })

  it('formats timestamps without seconds', () => {
    const formatted = formatMessageTime(Date.UTC(2026, 8, 16, 10, 7, 45))
    expect(formatted).toMatch(/\d{1,2}:\d{2}/)
    expect(formatted).not.toMatch(/:\d{2}:\d{2}/)
  })
})
