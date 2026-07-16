import type { Id } from '../../../../convex/_generated/dataModel';

export type MobileTaskIdentity = {
  archived?: boolean;
  companyId: Id<'companies'>;
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

export function taskListHref(projectId: Id<'projects'>, identity: MobileTaskIdentity | null) {
  return `/tasks?projectId=${encodeURIComponent(projectId)}${taskContext(identity)}` as const;
}

export function taskDetailHref(
  projectId: Id<'projects'>,
  publicKey: string,
  identity: MobileTaskIdentity | null,
) {
  return `/task?projectId=${encodeURIComponent(projectId)}&taskKey=${encodeURIComponent(publicKey)}${taskContext(identity)}` as const;
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
