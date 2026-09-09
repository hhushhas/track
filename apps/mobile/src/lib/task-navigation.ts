import type { Id } from '../../../../convex/_generated/dataModel';

export type MobileTaskIdentity = {
  archived?: boolean;
  companyId: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
};

export type MobileTaskNotificationContext = {
  companyId?: Id<'companies'>;
  id: Id<'taskNotifications'>;
  membershipId: Id<'projectMembers'>;
};

export type MobileTaskView = {
  task: {
    _id: string;
    workflowStateId: string;
  };
};

function taskContext(identity: MobileTaskIdentity | null) {
  if (!identity) return '';
  return `&companyId=${encodeURIComponent(identity.companyId)}&membershipId=${encodeURIComponent(identity.membershipId)}${identity.archived ? '&archive=1' : ''}`;
}

export function taskListHref(
  projectId: Id<'projects'>,
  identity: MobileTaskIdentity | null,
  tab?: 'inbox',
  suggestionId?: Id<'taskSuggestions'>,
  focus?: { boardId?: Id<'taskBoards'>; taskId?: Id<'tasks'> },
) {
  return `/tasks?projectId=${encodeURIComponent(projectId)}${taskContext(identity)}${tab ? '&tab=inbox' : ''}${suggestionId ? `&suggestionId=${encodeURIComponent(suggestionId)}` : ''}${focus?.boardId ? `&boardId=${encodeURIComponent(focus.boardId)}` : ''}${focus?.taskId ? `&taskId=${encodeURIComponent(focus.taskId)}` : ''}` as const;
}

export function taskDetailHref(
  projectId: Id<'projects'>,
  publicKey: string,
  identity: MobileTaskIdentity | null,
  notification?: MobileTaskNotificationContext,
) {
  const notificationContext = notification
    ? `&notificationId=${encodeURIComponent(notification.id)}&notificationMembershipId=${encodeURIComponent(notification.membershipId)}${notification.companyId ? `&notificationCompanyId=${encodeURIComponent(notification.companyId)}` : ''}`
    : '';
  return `/task?projectId=${encodeURIComponent(projectId)}&taskKey=${encodeURIComponent(publicKey)}${taskContext(identity)}${notificationContext}` as const;
}

export function groupMobileTasksByState<T extends MobileTaskView>(
  stateIds: readonly string[],
  tasks: readonly T[],
) {
  return stateIds.map((stateId) => ({
    stateId,
    tasks: tasks.filter((item) => item.task.workflowStateId === stateId),
  }));
}
