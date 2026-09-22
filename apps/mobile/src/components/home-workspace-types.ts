import type { Id } from '../../../../convex/_generated/dataModel';

export type HomeProject = {
  channelCount?: number;
  channels?: Array<{ id: Id<'groups'>; name: string }>;
  companyId: Id<'companies'>;
  companyName?: string;
  health: string;
  id: Id<'projects'>;
  memberCount: number;
  members?: Array<{ avatarUrl: string | null; id: Id<'users'>; name: string }>;
  membershipId: Id<'projectMembers'>;
  name: string;
  role: string;
  totalTasks?: number;
};

export type HomeTask = {
  assigneeName?: string | null;
  commentCount?: number;
  companyId?: Id<'companies'>;
  projectMemberId: Id<'projectMembers'>;
  project: { _id: Id<'projects'>; name: string };
  group?: { _id: Id<'groups'>; name: string } | null;
  board?: { _id: Id<'taskBoards'> } | null;
  state?: {
    category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
    name: string;
  } | null;
  task: {
    _id: Id<'tasks'>;
    dueDate?: string;
    groupId?: Id<'groups'>;
    priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
    publicKey: string;
    title: string;
  };
};

export type HomeActivity = {
  actorInitials: string;
  actorName: string;
  createdAt: number;
  groupId?: Id<'groups'>;
  id: string;
  kind: 'task' | 'message' | 'project';
  preview: string;
  projectId: Id<'projects'>;
  projectName: string;
  taskKey?: string;
  threadId?: Id<'channelThreads'>;
  title: string;
};

export type HomeStats = {
  completedTasks: number;
  dailyTasks: number;
  inProgressTasks: number;
  upcomingTasks: number;
};
