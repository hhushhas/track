import { describe, expect, it } from 'vitest';

import type { Id } from '../../../../convex/_generated/dataModel';
import { groupMobileTasksByState, taskDetailHref, taskListHref } from './task-navigation';

describe('mobile task navigation', () => {
  const projectId = 'project' as Id<'projects'>;
  const companyId = 'company' as Id<'companies'>;
  const membershipId = 'membership' as Id<'projectMembers'>;

  it('preserves represented Company task URLs and archive state', () => {
    const context = { archived: true, companyId, membershipId };
    expect(taskListHref(projectId, context)).toBe('/tasks?projectId=project&companyId=company&membershipId=membership&archive=1');
    expect(taskDetailHref(projectId, 'TRK-12', context)).toContain(
      'companyId=company&membershipId=membership&archive=1',
    );
  });

  it('groups task cards without dropping empty workflow states', () => {
    const tasks = [
      { task: { _id: 'one', workflowStateId: 'todo' } },
      { task: { _id: 'two', workflowStateId: 'done' } },
    ];
    expect(groupMobileTasksByState(['todo', 'doing', 'done'], tasks)).toEqual([
      { stateId: 'todo', tasks: [tasks[0]] },
      { stateId: 'doing', tasks: [] },
      { stateId: 'done', tasks: [tasks[1]] },
    ]);
  });
});
