import { describe, expect, it } from 'vitest';

import type { Id } from '../../../../convex/_generated/dataModel';
import { taskDetailHref, taskListHref } from './task-navigation';

describe('taskDetailHref', () => {
  it('preserves represented project context and the source notification', () => {
    const href = taskDetailHref(
      'project-1' as Id<'projects'>,
      'TRK-42',
      {
        archived: true,
        companyId: 'company-1' as Id<'companies'>,
        membershipId: 'member-1' as Id<'projectMembers'>,
      },
      {
        companyId: 'company-1' as Id<'companies'>,
        id: 'notification-1' as Id<'taskNotifications'>,
        membershipId: 'member-1' as Id<'projectMembers'>,
      },
    );

    expect(href).toBe(
      '/task?projectId=project-1&taskKey=TRK-42&companyId=company-1&membershipId=member-1&archive=1&notificationId=notification-1&notificationMembershipId=member-1&notificationCompanyId=company-1',
    );
  });

  it('retains read context for a personal project notification', () => {
    expect(taskDetailHref('project-1' as Id<'projects'>, 'TRK-42', null, {
      id: 'notification-1' as Id<'taskNotifications'>,
      membershipId: 'member-1' as Id<'projectMembers'>,
    })).toBe(
      '/task?projectId=project-1&taskKey=TRK-42&notificationId=notification-1&notificationMembershipId=member-1',
    );
  });

  it('omits optional context when opened outside the inbox', () => {
    expect(taskDetailHref('project-1' as Id<'projects'>, 'TRK-42', null)).toBe(
      '/task?projectId=project-1&taskKey=TRK-42',
    );
  });
});

describe('taskListHref', () => {
  it('targets the exact board and task without losing represented Company context', () => {
    expect(taskListHref(
      'project-1' as Id<'projects'>,
      {
        companyId: 'company-1' as Id<'companies'>,
        membershipId: 'member-1' as Id<'projectMembers'>,
      },
      undefined,
      undefined,
      {
        boardId: 'board-1' as Id<'taskBoards'>,
        taskId: 'task-1' as Id<'tasks'>,
      },
    )).toBe('/tasks?projectId=project-1&companyId=company-1&membershipId=member-1&boardId=board-1&taskId=task-1');
  });
});
