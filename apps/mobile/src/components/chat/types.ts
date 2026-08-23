import type { Doc, Id } from '../../../../../convex/_generated/dataModel';

/** An attachment paired with the signed URL the conversation query resolves for it. */
export type AttachmentWithUrl = { attachment: Doc<'attachments'>; url: string | null };

export type DetailedMessage = {
  message: Doc<'messages'>;
  author: Doc<'users'> | null;
  authorRole?: Doc<'projectMembers'>['role'] | null;
  authorCompany?: { companyId: Id<'companies'>; displayName: string } | null;
  attachments: AttachmentWithUrl[];
  replyTo?: { messageId: Id<'messages'>; authorName: string; body: string; createdAt: number } | null;
  channelThread?: {
    threadId: Id<'channelThreads'>;
    name: string;
    status: 'active' | 'archived';
    replyCount: number;
    latestReplyAt: number | null;
  } | null;
};

/** An image that the full-screen viewer can present. */
export type ViewableImage = {
  contentType: string;
  filename: string;
  id: string;
  size: number;
  url: string;
};
