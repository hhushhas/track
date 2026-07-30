import type { Doc, Id } from '../../../../convex/_generated/dataModel';

export type MobileTaskDetail = {
  task: Doc<'tasks'>;
  board: Doc<'taskBoards'> | null;
  state: Doc<'taskWorkflowStates'> | null;
  assignee: Doc<'projectMembers'> | null;
  creator: Doc<'projectMembers'> | null;
  references: Array<Doc<'taskReferences'>>;
  labels: Array<Doc<'taskLabels'>>;
  comments: Array<Doc<'taskComments'>>;
  activities: Array<Doc<'taskActivities'>>;
  following: boolean;
  restrictedEarlierContext: boolean;
  capabilities: {
    canArchive: boolean;
    canComment: boolean;
    canEdit: boolean;
  };
};

export type MobileTaskBoard = {
  board: Doc<'taskBoards'>;
  states: Array<Doc<'taskWorkflowStates'>>;
};

export type MobileTaskAssignee = {
  member: Doc<'projectMembers'>;
  user: { _id: Id<'users'>; displayName: string };
  company: Doc<'companies'> | null;
};

export type MobileTaskListItem = {
  task: Doc<'tasks'>;
  state: Doc<'taskWorkflowStates'> | null;
};
