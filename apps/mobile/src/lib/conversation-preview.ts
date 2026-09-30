import type { Href } from 'expo-router';

export type ConversationPreviewScope = {
  projectId: string;
  groupId: string;
  companyId?: string;
  membershipId?: string;
  archived: boolean;
  threadId?: string;
};

export type ConversationPreview = {
  href: Href;
  kind: 'channel' | 'thread';
  messages: Array<{ label: string; text: string }>;
  projectName: string;
  title: string;
  channelName: string;
  unread: boolean;
  scope: ConversationPreviewScope;
};

export function buildChannelPreview(input: {
  channelName: string;
  href: Href;
  lastMessage: string | null | undefined;
  projectName: string;
  unread: boolean;
  scope: ConversationPreviewScope;
}): ConversationPreview {
  const latestMessage = input.lastMessage?.trim();
  return {
    channelName: input.channelName,
    href: input.href,
    kind: 'channel',
    messages: latestMessage ? [{ label: 'Latest message', text: latestMessage }] : [],
    projectName: input.projectName,
    title: input.channelName,
    unread: input.unread,
    scope: input.scope,
  };
}

export function buildThreadPreview(input: {
  channelName: string;
  href: Href;
  latestReply: string | null | undefined;
  projectName: string;
  sourceMessage: string | null | undefined;
  title: string;
  unread: boolean;
  scope: ConversationPreviewScope;
}): ConversationPreview {
  const source = input.sourceMessage?.trim() ?? '';
  const reply = input.latestReply?.trim() ?? '';
  return {
    channelName: input.channelName,
    href: input.href,
    kind: 'thread',
    messages: [
      ...(source ? [{ label: 'Thread started from', text: source }] : []),
      ...(reply && reply !== source ? [{ label: 'Latest reply', text: reply }] : []),
    ],
    projectName: input.projectName,
    title: input.title,
    unread: input.unread,
    scope: input.scope,
  };
}
