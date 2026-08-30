import type { Doc } from '../../../../../convex/_generated/dataModel'
import { AttachmentTypeIcon, formatFileSize } from './attachment-ui'
import { VoiceNotePlayer, isAudioAttachment } from './voice-notes'

type MessageAttachmentRecord = {
  _id: string
  contentType: string
  filename: string
  size: number
  kind?: Doc<'attachments'>['kind']
  durationMs?: number
}

export type MessageAttachmentItem = {
  attachment: MessageAttachmentRecord
  url: string | null
}

export function MessageAttachmentList({ attachments }: { attachments: Array<MessageAttachmentItem> }) {
  if (attachments.length === 0) return null
  return (
    <div className="track-attachment-list">
      {attachments.map(({ attachment, url }) => {
        const isImage = attachment.contentType.startsWith('image/')
        if (isAudioAttachment(attachment)) {
          return (
            <VoiceNotePlayer
              contentType={attachment.contentType}
              durationMs={attachment.durationMs}
              filename={attachment.filename}
              kind={attachment.kind}
              key={attachment._id}
              size={attachment.size}
              url={url}
            />
          )
        }
        const content = isImage ? (
          <>
            {url ? (
              <img alt={attachment.filename} src={url} />
            ) : (
              <span className="track-attachment-file-icon">
                <AttachmentTypeIcon
                  contentType={attachment.contentType}
                  filename={attachment.filename}
                  size={16}
                />
              </span>
            )}
            <span>
              <strong>{attachment.filename}</strong>
              <small>{formatFileSize(attachment.size)}</small>
            </span>
          </>
        ) : (
          <>
            <span className="track-attachment-file-icon">
              <AttachmentTypeIcon
                contentType={attachment.contentType}
                filename={attachment.filename}
                size={16}
              />
            </span>
            <span>
              <strong>{attachment.filename}</strong>
              <small>{formatFileSize(attachment.size)}</small>
            </span>
          </>
        )

        return url ? (
          <a
            className={isImage ? 'track-attachment-card image' : 'track-attachment-card file'}
            href={url}
            key={attachment._id}
            rel="noreferrer"
            target="_blank"
          >
            {content}
          </a>
        ) : (
          <span
            className={isImage ? 'track-attachment-card image' : 'track-attachment-card file'}
            key={attachment._id}
          >
            {content}
          </span>
        )
      })}
    </div>
  )
}
