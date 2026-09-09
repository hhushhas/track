import type { Id } from '../../../../convex/_generated/dataModel';
import { representedContextQuery, type RepresentedProjectContext } from './company-navigation';

export function threadListHref(
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  context?: RepresentedProjectContext | null,
  sourceMessageId?: Id<'messages'>,
) {
  const source = sourceMessageId ? `&sourceMessageId=${encodeURIComponent(sourceMessageId)}` : '';
  return `/threads?projectId=${encodeURIComponent(projectId)}&groupId=${encodeURIComponent(groupId)}${representedContextQuery(context ?? null)}${source}`;
}

export function threadConversationHref(
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  threadId: Id<'channelThreads'>,
  context?: RepresentedProjectContext | null,
  messageId?: Id<'messages'>,
) {
  const message = messageId ? `&messageId=${encodeURIComponent(messageId)}` : '';
  return `/thread?projectId=${encodeURIComponent(projectId)}&groupId=${encodeURIComponent(groupId)}&threadId=${encodeURIComponent(threadId)}${representedContextQuery(context ?? null)}${message}`;
}

export function forwardedSourceHref(
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  messageId: Id<'messages'>,
  threadId: Id<'channelThreads'> | undefined,
  context?: RepresentedProjectContext | null,
) {
  if (threadId) return threadConversationHref(projectId, groupId, threadId, context, messageId);
  const message = `&messageId=${encodeURIComponent(messageId)}`;
  return `/conversation?projectId=${encodeURIComponent(projectId)}&groupId=${encodeURIComponent(groupId)}${representedContextQuery(context ?? null)}${message}`;
}
