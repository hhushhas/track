import { useState } from 'react'
import type { CSSProperties } from 'react'

import './media-preview.css'

export type MediaPreviewDimensions =
  | {
      height: number
      kind: 'known'
      previewHeight: number
      previewWidth: number
      width: number
    }
  | {
      kind: 'unknown'
    }

export type MediaPreviewAttachment = {
  contentType: string
  dimensions: MediaPreviewDimensions
  filename: string
  originalUrl?: string | null
  previewUrl?: string | null
}

type MediaSource = {
  isFallback: boolean
  url: string | null
}

const MIN_PREVIEW_ASPECT_RATIO = 0.56
const MAX_PREVIEW_ASPECT_RATIO = 1.9

export function resolveMediaSource(
  attachment: Pick<MediaPreviewAttachment, 'originalUrl' | 'previewUrl'>,
  previewFailed: boolean,
): MediaSource {
  const previewUrl = attachment.previewUrl ?? null
  const originalUrl = attachment.originalUrl ?? null
  if (!previewFailed && previewUrl) return { isFallback: false, url: previewUrl }
  if (originalUrl) return { isFallback: true, url: originalUrl }
  return { isFallback: false, url: previewUrl }
}

function previewAspectRatio(attachment: MediaPreviewAttachment) {
  if (attachment.dimensions.kind === 'unknown') return 4 / 3
  return Math.min(
    Math.max(attachment.dimensions.width / attachment.dimensions.height, MIN_PREVIEW_ASPECT_RATIO),
    MAX_PREVIEW_ASPECT_RATIO,
  )
}

type MediaPreviewProps = {
  attachment: MediaPreviewAttachment
  className?: string
  linkToOriginal?: boolean
}

export function MediaPreview(props: MediaPreviewProps) {
  const sourceKey = JSON.stringify([
    props.attachment.originalUrl ?? null,
    props.attachment.previewUrl ?? null,
  ])
  return <MediaPreviewContent key={sourceKey} {...props} />
}

function MediaPreviewContent({
  attachment,
  className,
  linkToOriginal = true,
}: MediaPreviewProps) {
  const [previewFailed, setPreviewFailed] = useState(false)
  const [originalFailed, setOriginalFailed] = useState(false)
  const resolvedSource = resolveMediaSource(attachment, previewFailed)
  const source: MediaSource = originalFailed ? { isFallback: resolvedSource.isFallback, url: null } : resolvedSource
  const aspectRatio = previewAspectRatio(attachment)
  const dimensions = attachment.dimensions.kind === 'known' ? attachment.dimensions : null
  const frameStyle: CSSProperties = {
    aspectRatio,
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: 'min(640px, 100%)',
  }

  if (!source.url) {
    return (
      <span
        aria-label={`${attachment.filename} preview unavailable`}
        className={className ? `${className} track-media-preview-empty` : 'track-media-preview-empty'}
        style={frameStyle}
      >
        {attachment.filename}
      </span>
    )
  }

  const image = (
    <img
      alt={attachment.filename}
      className="track-media-preview-image"
      decoding="async"
      height={dimensions?.previewHeight ?? dimensions?.height}
      loading="lazy"
      onError={() => {
        if (source.isFallback || !attachment.originalUrl) {
          setOriginalFailed(true)
          return
        }
        setPreviewFailed(true)
      }}
      src={source.url}
      style={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }}
      width={dimensions?.previewWidth ?? dimensions?.width}
    />
  )

  return (
    <span className={className ? `${className} track-media-preview` : 'track-media-preview'} style={frameStyle}>
      {linkToOriginal && attachment.originalUrl ? (
        <a
          aria-label={`Open ${attachment.filename}`}
          className="track-media-preview-link"
          href={attachment.originalUrl}
          rel="noreferrer"
          target="_blank"
        >
          {image}
        </a>
      ) : (
        image
      )}
    </span>
  )
}
