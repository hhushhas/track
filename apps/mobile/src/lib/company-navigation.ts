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
  return `/conversations?projectId=${encodeURIComponent(projectId)}${context ? `&companyId=${encodeURIComponent(context.companyId)}&membershipId=${encodeURIComponent(context.membershipId)}${context.archived ? '&archive=1' : ''}` : ''}` as Href;
}

export function projectOverviewHref(projectId: Id<'projects'>, context: RepresentedProjectContext | null) {
  return `/project?projectId=${encodeURIComponent(projectId)}${representedContextQuery(context)}` as Href;
}

export function projectSettingsHref(projectId: Id<'projects'>, context: RepresentedProjectContext | null) {
  return `/project-settings?projectId=${encodeURIComponent(projectId)}${representedContextQuery(context)}` as Href;
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
    ? 'This item isn’t available from the selected Company, or your access has ended.'
    : 'This item isn’t available, or your Project access has ended.';
}
