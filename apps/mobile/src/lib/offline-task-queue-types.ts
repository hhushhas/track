import type { Id } from '../../../../convex/_generated/dataModel';

export type OfflineTaskCreate = {
  projectId: Id<'projects'>;
  groupId?: Id<'groups'>;
  title: string;
  priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
  dueDate?: string;
  assigneeProjectMemberId?: Id<'projectMembers'>;
  references?: Array<{
    type: 'message' | 'assistant_answer';
    messageId?: Id<'messages'>;
    assistantStreamId?: Id<'assistantStreams'>;
    isPrimary: boolean;
  }>;
  idempotencyKey: string;
  actingCompanyId?: Id<'companies'>;
  projectMemberId?: Id<'projectMembers'>;
};

export type OfflineTaskItem = OfflineTaskCreate & { queuedAt: number; lastError?: string };

