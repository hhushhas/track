import { describe, expect, it } from 'vitest'

import { formatCopiedAttachmentCount, getForwardedSourceLabel } from './thread-items'

describe('workspace message forwarding display', () => {
  it('hides the source Group name when no accessible source name is supplied', () => {
    expect(getForwardedSourceLabel({ sourceGroupName: null })).toBe('Forwarded message')
  })

  it('shows the source Group name when the viewer can access it', () => {
    expect(getForwardedSourceLabel({ sourceGroupName: 'Internal' })).toBe('Forwarded from Internal')
  })

  it('formats copied attachment counts', () => {
    expect(formatCopiedAttachmentCount(1)).toBe('1 attachment copied')
    expect(formatCopiedAttachmentCount(2)).toBe('2 attachments copied')
  })
})
