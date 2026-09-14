/** Maximum source payload accepted by the preview worker before decoding. */
export const maxPreviewSourceBytes = 20 * 1024 * 1024

/** Maximum decoded pixel count accepted by the preview worker. */
export const maxPreviewPixels = 40_000_000

/** Maximum width or height accepted from an image header. */
export const maxPreviewDimension = 16_384

/** The largest dimension used for an inline conversation preview. */
export const previewMaxDimension = 640

export type ImageFormat = 'bmp' | 'gif' | 'jpeg' | 'png' | 'webp'

export type ImageMetadata = {
  format: ImageFormat
  height: number
  width: number
}

export type ImageMetadataResult =
  | { ok: true; metadata: ImageMetadata }
  | { ok: false; reason: string }

export type ImageMetadataLimits = {
  maxBytes: number
  maxDimension: number
  maxPixels: number
}

export type ImageDimensionInput = Pick<ImageMetadata, 'height' | 'width'>

const defaultLimits: ImageMetadataLimits = {
  maxBytes: maxPreviewSourceBytes,
  maxDimension: maxPreviewDimension,
  maxPixels: maxPreviewPixels,
}

function hasBytes(data: Uint8Array, endExclusive: number) {
  return endExclusive <= data.byteLength
}

function isPng(data: Uint8Array) {
  return (
    data.byteLength >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a &&
    data[12] === 0x49 &&
    data[13] === 0x48 &&
    data[14] === 0x44 &&
    data[15] === 0x52
  )
}

function readPng(data: Uint8Array): ImageMetadataResult {
  if (!isPng(data)) return { ok: false, reason: 'unsupported or malformed PNG header' }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    ok: true,
    metadata: {
      format: 'png',
      height: view.getUint32(20),
      width: view.getUint32(16),
    },
  }
}

function readGif(data: Uint8Array): ImageMetadataResult {
  if (
    data.byteLength < 10 ||
    data[0] !== 0x47 ||
    data[1] !== 0x49 ||
    data[2] !== 0x46 ||
    data[3] !== 0x38 ||
    (data[4] !== 0x37 && data[4] !== 0x39) ||
    data[5] !== 0x61
  ) {
    return { ok: false, reason: 'unsupported or malformed GIF header' }
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    ok: true,
    metadata: {
      format: 'gif',
      height: view.getUint16(8, true),
      width: view.getUint16(6, true),
    },
  }
}

function isJpegStartOfFrame(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function readJpeg(data: Uint8Array): ImageMetadataResult {
  if (data.byteLength < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return { ok: false, reason: 'unsupported or malformed JPEG header' }
  }

  let offset = 2
  while (offset < data.byteLength) {
    while (offset < data.byteLength && data[offset] === 0xff) offset += 1
    if (offset >= data.byteLength) break
    const marker = data[offset]
    offset += 1
    if (marker === 0x00) return { ok: false, reason: 'malformed JPEG marker' }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    if (!hasBytes(data, offset + 2)) return { ok: false, reason: 'truncated JPEG segment' }
    const segmentLength = (data[offset] << 8) | data[offset + 1]
    if (segmentLength < 2 || !hasBytes(data, offset + segmentLength)) {
      return { ok: false, reason: 'invalid JPEG segment length' }
    }
    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 7) return { ok: false, reason: 'truncated JPEG frame header' }
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
      return {
        ok: true,
        metadata: {
          format: 'jpeg',
          height: view.getUint16(offset + 3),
          width: view.getUint16(offset + 5),
        },
      }
    }
    offset += segmentLength
  }
  return { ok: false, reason: 'JPEG frame dimensions not found' }
}

function readWebp(data: Uint8Array): ImageMetadataResult {
  if (
    data.byteLength < 30 ||
    data[0] !== 0x52 ||
    data[1] !== 0x49 ||
    data[2] !== 0x46 ||
    data[3] !== 0x46 ||
    data[8] !== 0x57 ||
    data[9] !== 0x45 ||
    data[10] !== 0x42 ||
    data[11] !== 0x50 ||
    data[12] !== 0x56 ||
    data[13] !== 0x50 ||
    data[14] !== 0x38 ||
    data[15] !== 0x58
  ) {
    return { ok: false, reason: 'unsupported or malformed WebP header' }
  }
  const width = 1 + data[24] + (data[25] << 8) + (data[26] << 16)
  const height = 1 + data[27] + (data[28] << 8) + (data[29] << 16)
  return { ok: true, metadata: { format: 'webp', height, width } }
}

function readBmp(data: Uint8Array): ImageMetadataResult {
  if (data.byteLength < 26 || data[0] !== 0x42 || data[1] !== 0x4d) {
    return { ok: false, reason: 'unsupported or malformed BMP header' }
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const width = view.getInt32(18, true)
  const signedHeight = view.getInt32(22, true)
  return {
    ok: true,
    metadata: { format: 'bmp', height: Math.abs(signedHeight), width },
  }
}

function parseMetadata(data: Uint8Array): ImageMetadataResult {
  if (isPng(data)) return readPng(data)
  if (data.byteLength >= 6 && data[0] === 0x47 && data[1] === 0x49) return readGif(data)
  if (data.byteLength >= 2 && data[0] === 0xff && data[1] === 0xd8) return readJpeg(data)
  if (data.byteLength >= 12 && data[0] === 0x52 && data[1] === 0x49) return readWebp(data)
  if (data.byteLength >= 2 && data[0] === 0x42 && data[1] === 0x4d) return readBmp(data)
  return { ok: false, reason: 'unsupported image format' }
}

export function validateImageDimensions(
  dimensions: ImageDimensionInput,
  limits: Partial<ImageMetadataLimits> = {},
): ImageMetadataResult {
  const maxDimension = limits.maxDimension ?? defaultLimits.maxDimension
  const maxPixels = limits.maxPixels ?? defaultLimits.maxPixels
  const metadata: ImageMetadata = { format: 'png', ...dimensions }
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)) {
    return { ok: false, reason: 'image dimensions are not integers' }
  }
  if (metadata.width < 1 || metadata.height < 1) {
    return { ok: false, reason: 'image dimensions must be positive' }
  }
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    return { ok: false, reason: 'image dimensions exceed the decoder limit' }
  }
  if (metadata.width * metadata.height > maxPixels) {
    return { ok: false, reason: 'image pixel count exceeds the decoder limit' }
  }
  return { ok: true, metadata }
}

export function readImageMetadata(
  data: Uint8Array,
  limits: Partial<ImageMetadataLimits> = {},
): ImageMetadataResult {
  const resolvedLimits: ImageMetadataLimits = {
    maxBytes: limits.maxBytes ?? defaultLimits.maxBytes,
    maxDimension: limits.maxDimension ?? defaultLimits.maxDimension,
    maxPixels: limits.maxPixels ?? defaultLimits.maxPixels,
  }
  if (data.byteLength === 0) return { ok: false, reason: 'image is empty' }
  if (data.byteLength > resolvedLimits.maxBytes) return { ok: false, reason: 'image exceeds the source byte limit' }
  const parsed = parseMetadata(data)
  if (!parsed.ok) return parsed
  const validated = validateImageDimensions(parsed.metadata, resolvedLimits)
  return validated.ok ? parsed : validated
}

export function calculatePreviewDimensions(metadata: Pick<ImageMetadata, 'height' | 'width'>) {
  const scale = Math.min(
    1,
    previewMaxDimension / metadata.width,
    previewMaxDimension / metadata.height,
  )
  return {
    height: Math.max(1, Math.round(metadata.height * scale)),
    width: Math.max(1, Math.round(metadata.width * scale)),
  }
}
