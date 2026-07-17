export type PushContext = {
  projectId?: string;
  groupId?: string;
  threadId?: string;
  taskKey?: string;
};

let activeContext: PushContext | null = null;

export function setActivePushContext(context: PushContext | null) {
  activeContext = context;
}

export function shouldPresentPush(data: Record<string, unknown> | null | undefined) {
  if (!activeContext) return true;
  const sameProject = !activeContext.projectId || data?.projectId === activeContext.projectId;
  if (!sameProject) return true;
  if (activeContext.taskKey) return data?.taskKey !== activeContext.taskKey;
  if (!activeContext.groupId || data?.groupId !== activeContext.groupId) return true;
  if (activeContext.threadId) return data?.threadId !== activeContext.threadId;
  return Boolean(data?.threadId);
}
