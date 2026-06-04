import { unzipSync } from 'fflate'

const maxExtractedTextLength = 6000

type ExtractionInput = {
  contentType: string
  data: Uint8Array
  filename: string
}

type ExtractionResult =
  | { ok: true; text: string; type: 'docx' | 'text' }
  | { ok: false; reason: string }

const textContentTypes = new Set([
  'application/json',
  'application/xml',
  'text/csv',
  'text/markdown',
  'text/plain',
  'text/xml',
])

const docxContentTypes = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-docx',
])

export function extractAttachmentText(input: ExtractionInput): ExtractionResult {
  const filename = input.filename.toLowerCase()
  const contentType = input.contentType.toLowerCase().split(';')[0]?.trim() ?? ''

  if (docxContentTypes.has(contentType) || filename.endsWith('.docx')) {
    return extractDocxText(input.data)
  }

  if (contentType.startsWith('text/') || textContentTypes.has(contentType) || isTextFilename(filename)) {
    return extractPlainText(input.data)
  }

  return { ok: false, reason: 'local text extraction is not supported for this file type' }
}

export function formatExtractedAttachmentNote(input: { filename: string; question: string; text: string }) {
  const extracted = compactExtractedText(input.text, maxExtractedTextLength)
  return [
    `${input.filename}: locally extracted text available for the assistant.`,
    `User question: ${input.question}`,
    `Extracted text: ${extracted}`,
  ].join('\n')
}

function extractDocxText(data: Uint8Array): ExtractionResult {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    return { ok: false, reason: 'docx zip could not be opened' }
  }

  const xmlParts = Object.entries(files)
    .filter(([path]) => isReadableDocxXmlPath(path))
    .sort(([left], [right]) => compareDocxPartPaths(left, right))
    .map(([, bytes]) => decodeUtf8(bytes))
    .filter(Boolean)

  if (xmlParts.length === 0) return { ok: false, reason: 'docx did not contain readable word XML' }

  const text = compactExtractedText(xmlParts.map(extractWordXmlText).join('\n'))
  if (!text) return { ok: false, reason: 'docx contained no readable text' }
  return { ok: true, text, type: 'docx' }
}

function extractPlainText(data: Uint8Array): ExtractionResult {
  const text = compactExtractedText(decodeUtf8(data))
  if (!text) return { ok: false, reason: 'file contained no readable text' }
  return { ok: true, text, type: 'text' }
}

function extractWordXmlText(xml: string) {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, decodeXmlEntity)
}

function decodeXmlEntity(entity: string) {
  switch (entity.toLowerCase()) {
    case '&amp;':
      return '&'
    case '&lt;':
      return '<'
    case '&gt;':
      return '>'
    case '&quot;':
      return '"'
    case '&apos;':
      return "'"
    default:
      if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
        return decodeEntityCodePoint(Number.parseInt(entity.slice(3, -1), 16), entity)
      }
      if (entity.startsWith('&#')) {
        return decodeEntityCodePoint(Number.parseInt(entity.slice(2, -1), 10), entity)
      }
      return entity
  }
}

function decodeEntityCodePoint(codePoint: number, fallback: string) {
  if (!Number.isFinite(codePoint)) return fallback
  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return fallback
  }
}

function decodeUtf8(data: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(data)
}

function compactExtractedText(value: string, maxLength = maxExtractedTextLength) {
  const compacted = value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3).trim()}...` : compacted
}

function compareDocxPartPaths(left: string, right: string) {
  return docxPartRank(left) - docxPartRank(right) || left.localeCompare(right)
}

function docxPartRank(path: string) {
  const normalized = normalizeZipPath(path)
  if (/^word\/document\.xml$/i.test(normalized)) return 0
  if (/^word\/header\d*\.xml$/i.test(normalized)) return 1
  if (/^word\/footer\d*\.xml$/i.test(normalized)) return 2
  if (/^word\/comments\.xml$/i.test(normalized)) return 3
  if (/^word\/footnotes\.xml$/i.test(normalized)) return 4
  if (/^word\/endnotes\.xml$/i.test(normalized)) return 5
  return 6
}

function isReadableDocxXmlPath(path: string) {
  const normalized = normalizeZipPath(path)
  return (
    /^word\/document\.xml$/i.test(normalized) ||
    /^word\/(footnotes|endnotes|comments)\.xml$/i.test(normalized) ||
    /^word\/(header|footer)\d*\.xml$/i.test(normalized)
  )
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function isTextFilename(filename: string) {
  return /\.(csv|json|log|md|txt|xml)$/i.test(filename)
}
