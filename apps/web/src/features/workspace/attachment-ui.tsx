import {
  Archive,
  BookOpen,
  Box,
  Braces,
  Database,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType2,
  FileVideo,
  Globe2,
  ImageIcon,
  KeyRound,
  Presentation,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type AttachmentTone =
  | 'archive'
  | 'audio'
  | 'cad'
  | 'code'
  | 'data'
  | 'design'
  | 'doc'
  | 'ebook'
  | 'file'
  | 'font'
  | 'google'
  | 'html'
  | 'image'
  | 'markdown'
  | 'pdf'
  | 'secret'
  | 'sheet'
  | 'slides'
  | 'text'
  | 'video'

type AttachmentKind = {
  extensions?: string[]
  icon: LucideIcon
  label: string
  mimePrefixes?: string[]
  mimeSubstrings?: string[]
  tone: AttachmentTone
}

const attachmentKinds = [
  {
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'ico'],
    icon: FileImage,
    label: 'Image',
    mimePrefixes: ['image/'],
    tone: 'image',
  },
  {
    extensions: ['pdf'],
    icon: FileType2,
    label: 'PDF',
    mimeSubstrings: ['pdf'],
    tone: 'pdf',
  },
  {
    extensions: ['doc', 'docx', 'odt', 'pages', 'rtf'],
    icon: FileText,
    label: 'Doc',
    mimeSubstrings: ['msword', 'officedocument.wordprocessingml', 'opendocument.text', 'rtf'],
    tone: 'doc',
  },
  {
    extensions: ['txt', 'log'],
    icon: FileText,
    label: 'Text',
    mimePrefixes: ['text/plain'],
    tone: 'text',
  },
  {
    extensions: ['md', 'markdown', 'mdx'],
    icon: FileText,
    label: 'MD',
    mimeSubstrings: ['markdown'],
    tone: 'markdown',
  },
  {
    extensions: ['xls', 'xlsx', 'xlsm', 'csv', 'tsv', 'ods', 'numbers'],
    icon: FileSpreadsheet,
    label: 'Sheet',
    mimeSubstrings: ['csv', 'excel', 'officedocument.spreadsheetml', 'opendocument.spreadsheet'],
    tone: 'sheet',
  },
  {
    extensions: ['ppt', 'pptx', 'pptm', 'odp', 'key'],
    icon: Presentation,
    label: 'Slides',
    mimeSubstrings: ['powerpoint', 'presentation', 'officedocument.presentationml', 'opendocument.presentation'],
    tone: 'slides',
  },
  {
    extensions: ['gdoc', 'gdraw', 'gform', 'gsheet', 'gslides'],
    icon: Globe2,
    label: 'Google',
    mimeSubstrings: ['google-apps'],
    tone: 'google',
  },
  {
    extensions: ['htm', 'html'],
    icon: FileCode2,
    label: 'HTML',
    mimeSubstrings: ['html'],
    tone: 'html',
  },
  {
    extensions: ['json', 'jsonl'],
    icon: FileJson,
    label: 'JSON',
    mimeSubstrings: ['json'],
    tone: 'data',
  },
  {
    extensions: ['xml', 'yaml', 'yml', 'toml', 'ini', 'env'],
    icon: Braces,
    label: 'Data',
    mimeSubstrings: ['xml', 'yaml'],
    tone: 'data',
  },
  {
    extensions: [
      'c',
      'cc',
      'cpp',
      'cs',
      'css',
      'go',
      'java',
      'js',
      'jsx',
      'kt',
      'php',
      'py',
      'rb',
      'rs',
      'scss',
      'sh',
      'sql',
      'swift',
      'ts',
      'tsx',
      'vue',
    ],
    icon: FileTerminal,
    label: 'Code',
    mimeSubstrings: ['javascript', 'typescript', 'x-sh', 'x-sql'],
    tone: 'code',
  },
  {
    extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'aiff', 'mid', 'midi', 'weba'],
    icon: FileAudio,
    label: 'Audio',
    mimePrefixes: ['audio/'],
    tone: 'audio',
  },
  {
    extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'ogv', 'wmv'],
    icon: FileVideo,
    label: 'Video',
    mimePrefixes: ['video/'],
    tone: 'video',
  },
  {
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'dmg', 'iso'],
    icon: FileArchive,
    label: 'Zip',
    mimeSubstrings: ['archive', 'compressed', 'gzip', 'tar', 'zip'],
    tone: 'archive',
  },
  {
    extensions: ['ai', 'fig', 'indd', 'psd', 'sketch', 'xd'],
    icon: ImageIcon,
    label: 'Design',
    mimeSubstrings: ['photoshop', 'illustrator'],
    tone: 'design',
  },
  {
    extensions: ['svg'],
    icon: FileCode2,
    label: 'SVG',
    mimeSubstrings: ['svg'],
    tone: 'design',
  },
  {
    extensions: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
    icon: FileType2,
    label: 'Font',
    mimePrefixes: ['font/'],
    mimeSubstrings: ['font', 'woff'],
    tone: 'font',
  },
  {
    extensions: ['epub', 'mobi', 'azw', 'azw3'],
    icon: BookOpen,
    label: 'Book',
    mimeSubstrings: ['epub'],
    tone: 'ebook',
  },
  {
    extensions: ['db', 'sqlite', 'sqlite3', 'db3', 'mdb'],
    icon: Database,
    label: 'DB',
    tone: 'data',
  },
  {
    extensions: ['pem', 'key', 'cer', 'crt', 'p12', 'pfx'],
    icon: KeyRound,
    label: 'Key',
    tone: 'secret',
  },
  {
    extensions: ['apk', 'app', 'exe', 'msi', 'pkg'],
    icon: Box,
    label: 'App',
    tone: 'archive',
  },
] satisfies AttachmentKind[]

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function getAttachmentKind(input: { contentType?: string | null; filename: string }) {
  const contentType = input.contentType?.toLowerCase() ?? ''
  const extension = input.filename.split('.').pop()?.toLowerCase() ?? ''
  const matchedKind = attachmentKinds.find((kind) => matchesAttachmentKind(kind, contentType, extension))

  if (matchedKind) return matchedKind

  return {
    icon: Archive,
    label: extension ? extension.toUpperCase().slice(0, 5) : 'File',
    tone: 'file',
  } satisfies AttachmentKind
}

function matchesAttachmentKind(kind: AttachmentKind, contentType: string, extension: string) {
  return (
    includesValue(kind.extensions, extension) ||
    matchesAnyPrefix(kind.mimePrefixes, contentType) ||
    matchesAnySubstring(kind.mimeSubstrings, contentType)
  )
}

function includesValue(values: string[] | undefined, value: string) {
  return value.length > 0 && Boolean(values?.includes(value))
}

function matchesAnyPrefix(prefixes: string[] | undefined, value: string) {
  return value.length > 0 && Boolean(prefixes?.some((prefix) => value.startsWith(prefix)))
}

function matchesAnySubstring(substrings: string[] | undefined, value: string) {
  return value.length > 0 && Boolean(substrings?.some((substring) => value.includes(substring)))
}

export function AttachmentTypeIcon({
  contentType,
  filename,
  size = 15,
}: {
  contentType?: string | null
  filename: string
  size?: number
}) {
  const kind = getAttachmentKind({ contentType, filename })
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  const Icon = kind.icon
  const brand = ['xlsx', 'xls', 'csv'].includes(extension)
    ? 'spreadsheet'
    : extension === 'pdf'
      ? 'pdf-brand'
      : extension === 'fig'
        ? 'figma'
        : ['md', 'markdown', 'txt', 'text'].includes(extension)
          ? 'markdown-brand'
          : null

  return (
    <span aria-label={kind.label} className={`track-attachment-type-icon ${brand ?? kind.tone}`} role="img">
      {brand === 'spreadsheet' ? <strong aria-hidden="true">X</strong> : null}
      {brand === 'pdf-brand' ? <small aria-hidden="true">PDF</small> : null}
      {brand === 'markdown-brand' ? <small aria-hidden="true">MD</small> : null}
      {brand === 'figma' ? (
        <svg aria-hidden="true" className="track-figma-mark" viewBox="0 0 16 24">
          <path d="M4 0h4v8H4a4 4 0 0 1 0-8Z" fill="#f24e1e" />
          <path d="M8 0h4a4 4 0 0 1 0 8H8Z" fill="#ff7262" />
          <path d="M4 8h4v8H4a4 4 0 0 1 0-8Z" fill="#a259ff" />
          <circle cx="12" cy="12" r="4" fill="#1abcfe" />
          <path d="M4 16h4v4a4 4 0 1 1-4-4Z" fill="#0acf83" />
        </svg>
      ) : null}
      {!brand ? (
        <>
          <Icon aria-hidden="true" size={size} />
          <small>{kind.label}</small>
        </>
      ) : null}
    </span>
  )
}
