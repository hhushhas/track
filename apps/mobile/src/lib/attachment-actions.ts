import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

/**
 * Attachment downloads land in a dedicated cache directory keyed by attachment
 * id, so repeated opens reuse the local copy and the system may reclaim the
 * space when storage runs low.
 */
const CACHE_DIRECTORY = 'attachments';

const UNSAFE_NAME = /[^a-zA-Z0-9._-]/g;

export type AttachmentTarget = {
  /** Stable id used to namespace the cached copy. */
  cacheKey: string;
  contentType: string;
  filename: string;
  url: string;
};

function localFile({ cacheKey, filename }: AttachmentTarget) {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY);
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  const safeName = filename.replace(UNSAFE_NAME, '_') || 'file';
  return new File(directory, `${cacheKey}-${safeName}`);
}

/** Downloads the attachment to the cache directory and resolves its local URI. */
export async function downloadAttachment(target: AttachmentTarget) {
  const destination = localFile(target);
  if (destination.exists) return destination.uri;
  const downloaded = await File.downloadFileAsync(target.url, destination, { idempotent: true });
  return downloaded.uri;
}

/**
 * Downloads the attachment, then hands the local copy to the system share and
 * open sheet. Falls back to opening the remote URL when sharing is unavailable.
 */
export async function shareAttachment(target: AttachmentTarget) {
  if (!(await Sharing.isAvailableAsync())) {
    await Linking.openURL(target.url);
    return;
  }
  const uri = await downloadAttachment(target);
  await Sharing.shareAsync(uri, {
    dialogTitle: target.filename,
    mimeType: target.contentType,
    UTI: target.contentType,
  });
}

/** Human-readable failure copy for a download or share attempt. */
export function attachmentActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() || 'Download failed';
}
