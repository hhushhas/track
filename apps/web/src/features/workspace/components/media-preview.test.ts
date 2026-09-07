import { describe, expect, it } from 'vitest'

import { resolveMediaSource } from './MediaPreview'

describe('media preview source selection', () => {
  it('uses the sized preview for conversation content', () => {
    expect(resolveMediaSource({ originalUrl: 'https://files/original', previewUrl: 'https://files/preview' }, false)).toEqual({
      isFallback: false,
      url: 'https://files/preview',
    })
  })

  it('falls back to the original only when the preview is missing or failed', () => {
    expect(resolveMediaSource({ originalUrl: 'https://files/original', previewUrl: null }, false)).toEqual({
      isFallback: true,
      url: 'https://files/original',
    })
    expect(resolveMediaSource({ originalUrl: 'https://files/original', previewUrl: 'https://files/preview' }, true)).toEqual({
      isFallback: true,
      url: 'https://files/original',
    })
  })

  it('keeps a preview usable when the original URL is unavailable', () => {
    expect(resolveMediaSource({ originalUrl: null, previewUrl: 'https://files/preview' }, false)).toEqual({
      isFallback: false,
      url: 'https://files/preview',
    })
  })
})
