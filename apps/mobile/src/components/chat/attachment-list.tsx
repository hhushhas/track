import { StyleSheet, View } from 'react-native';

import { FileAttachment } from '@/components/chat/file-attachment';
import { ImageAttachments } from '@/components/chat/image-attachment';
import type { AttachmentWithUrl, ViewableImage } from '@/components/chat/types';
import { VoiceNotePlayer } from '@/components/chat/voice-note-player';
import { Spacing } from '@/constants/theme';
import { isAudioAttachment, isImageAttachment } from '@/lib/attachment-presentation';

import type { Doc } from '../../../../../convex/_generated/dataModel';

type PlayableVoiceNote = { attachment: Doc<'attachments'>; url: string };

/**
 * Splits a message's attachments into the three presentations they deserve:
 * an image grid, voice note players, and file cards. Anything without a signed
 * URL falls back to the file card, which states that it is unavailable.
 */
export function AttachmentList({
  attachments,
  onLongPress,
}: {
  attachments: AttachmentWithUrl[];
  onLongPress?: () => void;
}) {
  const images: ViewableImage[] = [];
  const voiceNotes: PlayableVoiceNote[] = [];
  const files: AttachmentWithUrl[] = [];

  for (const entry of attachments) {
    const { attachment, url } = entry;
    if (!url) {
      files.push(entry);
      continue;
    }
    if (isImageAttachment(attachment.contentType)) {
      images.push({
        contentType: attachment.contentType,
        filename: attachment.filename,
        id: attachment._id,
        size: attachment.size,
        url,
      });
      continue;
    }
    if (isAudioAttachment(attachment)) {
      voiceNotes.push({ attachment, url });
      continue;
    }
    files.push(entry);
  }

  return (
    <View style={styles.stack}>
      {images.length ? <ImageAttachments images={images} onLongPress={onLongPress} /> : null}
      {voiceNotes.map(({ attachment, url }) => (
        <VoiceNotePlayer attachment={attachment} key={attachment._id} url={url} />
      ))}
      {files.map(({ attachment, url }) => (
        <FileAttachment
          attachment={attachment}
          key={attachment._id}
          onLongPress={onLongPress}
          url={url}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
});
