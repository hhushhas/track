import type { Id } from '../../../../convex/_generated/dataModel';
import type { Href } from 'expo-router';

export type RepresentedProjectContext = {
  companyId: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
  archived: boolean;
};

export function representedContextQuery(context: RepresentedProjectContext | null) {
  if (!context) return '';
  return `&companyId=${encodeURIComponent(context.companyId)}&membershipId=${encodeURIComponent(context.membershipId)}${context.archived ? '&archive=1' : ''}`;
}

export function projectChannelsHref(projectId: Id<'projects'>, context: RepresentedProjectContext | null) {
  return `/groups?projectId=${encodeURIComponent(projectId)}${representedContextQuery(context)}` as Href;
}

export function channelHref(
  projectId: Id<'projects'>,
  groupId: Id<'groups'>,
  context: RepresentedProjectContext | null,
  messageId?: Id<'messages'>,
) {
  const message = messageId ? `&messageId=${encodeURIComponent(messageId)}` : '';
  return `/conversation?groupId=${encodeURIComponent(groupId)}&projectId=${encodeURIComponent(projectId)}${representedContextQuery(context)}${message}` as Href;
}

export function navigationUnavailableCopy(hasCompanyContext: boolean) {
  return hasCompanyContext
    ? 'This link is not available for the represented Company, or access has ended.'
    : 'This link is unavailable, or Project access has ended.';
}
