import { describe, expect, it } from 'vitest'

import {
  calculatePreviewDimensions,
  maxPreviewSourceBytes,
  readImageMetadata,
} from './mediaPreview'

function pngHeader(width: number, height: number) {
  const data = new Uint8Array(24)
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(data.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return data
}

describe('media preview metadata', () => {
  it('reads trustworthy PNG dimensions and calculates a bounded preview', () => {
    const result = readImageMetadata(pngHeader(1920, 1080))

    expect(result).toEqual({ ok: true, metadata: { format: 'png', height: 1080, width: 1920 } })
    expect(calculatePreviewDimensions({ height: 1080, width: 1920 })).toEqual({ height: 360, width: 640 })
  })

  it('rejects oversized source bytes and decoded pixel bombs before processing', () => {
    expect(readImageMetadata(new Uint8Array(maxPreviewSourceBytes + 1))).toEqual({
      ok: false,
      reason: 'image exceeds the source byte limit',
    })
    expect(readImageMetadata(pngHeader(10_000, 10_000))).toEqual({
      ok: false,
      reason: 'image pixel count exceeds the decoder limit',
    })
  })

  it('fails closed for truncated or unsupported data', () => {
    expect(readImageMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({
      ok: false,
      reason: 'unsupported image format',
    })
    expect(readImageMetadata(new Uint8Array([0x00, 0x01, 0x02]))).toEqual({
      ok: false,
      reason: 'unsupported image format',
    })
  })
})
