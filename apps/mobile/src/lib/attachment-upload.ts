/**
 * Upload pipeline for composer attachments.
 *
 * The helpers here never touch Convex directly: the screen injects the three
 * mutation callers it already owns, so this module stays testable and free of
 * hooks. Files upload one at a time against a single message, which keeps a
 * failed file retryable without producing a duplicate message.
 */

export type AttachmentKind = 'file' | 'voice_note';

export type UploadableFile = {
  contentType: string;
  durationMs?: number;
  filename: string;
  id: string;
  kind?: AttachmentKind;
  size?: number;
  uri: string;
};

export type AttachmentUploadTarget = {
  attachFile: (input: {
    contentType: string;
    durationMs?: number;
    filename: string;
    kind?: AttachmentKind;
    messageId: string;
    size: number;
    storageId: string;
  }) => Promise<unknown>;
  generateUploadUrl: () => Promise<string>;
  sendMessage: (input: { body: string; replyToMessageId?: string }) => Promise<string>;
};

export type ComposerSubmission = {
  attachments: UploadableFile[];
  body: string;
  /** Set when retrying: reuses the message created by the first attempt. */
  messageId?: string | null;
  reportProgress: (attachmentId: string, progress: number) => void;
};

export type ComposerSubmissionResult = {
  failedIds: string[];
  messageId: string | null;
};

/** Progress updates land in React state, so only report meaningful steps. */
const ProgressStep = 0.05;

function fallbackBody(attachments: UploadableFile[]) {
  const [first] = attachments;
  if (first?.kind === 'voice_note') return 'Voice note';
  if (attachments.length === 1 && first) return `Attached ${first.filename}`;
  return `Attached ${attachments.length} files`;
}

function putBlob(input: {
  blob: Blob;
  contentType: string;
  onProgress: (fraction: number) => void;
  url: string;
}) {
  return new Promise<string>((resolve, reject) => {
    let reported = 0;
    const request = new XMLHttpRequest();
    request.open('POST', input.url);
    request.setRequestHeader('Content-Type', input.contentType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return;
      const fraction = Math.min(1, event.loaded / event.total);
      if (fraction - reported < ProgressStep && fraction < 1) return;
      reported = fraction;
      input.onProgress(fraction);
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error('upload_failed'));
        return;
      }
      const payload = JSON.parse(request.responseText) as { storageId?: string };
      if (!payload.storageId) {
        reject(new Error('upload_failed'));
        return;
      }
      resolve(payload.storageId);
    };
    request.onerror = () => reject(new Error('upload_failed'));
    request.ontimeout = () => reject(new Error('upload_timeout'));
    request.send(input.blob);
  });
}

async function uploadOne(input: {
  file: UploadableFile;
  messageId: string;
  onProgress: (fraction: number) => void;
  target: AttachmentUploadTarget;
}) {
  const url = await input.target.generateUploadUrl();
  const blob = await (await fetch(input.file.uri)).blob();
  const storageId = await putBlob({
    blob,
    contentType: input.file.contentType,
    onProgress: input.onProgress,
    url,
  });
  await input.target.attachFile({
    contentType: input.file.contentType,
    durationMs: input.file.durationMs,
    filename: input.file.filename,
    kind: input.file.kind ?? 'file',
    messageId: input.messageId,
    size: blob.size,
    storageId,
  });
}

/**
 * Sends the composer payload: one message, then every attachment in order.
 * Returns the ids that failed so the composer can keep them for a retry, along
 * with the message they belong to.
 */
export async function sendComposerMessage(
  input: ComposerSubmission & { replyToMessageId?: string; target: AttachmentUploadTarget },
): Promise<ComposerSubmissionResult> {
  const { attachments, body, replyToMessageId, reportProgress, target } = input;

  if (attachments.length === 0) {
    const messageId = await target.sendMessage({ body, replyToMessageId });
    return { failedIds: [], messageId };
  }

  const messageId =
    input.messageId ??
    (await target.sendMessage({ body: body || fallbackBody(attachments), replyToMessageId }));

  const failedIds: string[] = [];
  for (const file of attachments) {
    try {
      reportProgress(file.id, 0);
      await uploadOne({
        file,
        messageId,
        onProgress: (fraction) => reportProgress(file.id, fraction),
        target,
      });
      reportProgress(file.id, 1);
    } catch {
      failedIds.push(file.id);
      reportProgress(file.id, 0);
    }
  }

  return { failedIds, messageId };
}
