import { describe, expect, it } from 'vitest';

import { scopeMyTaskItems } from './my-task-scope';

describe('My Tasks Project scope', () => {
  it('limits task surfaces to the selected Project and restores all Projects when cleared', () => {
    const projectItems = [
      { id: 'one', project: { _id: 'project-one' } },
      { id: 'two', project: { _id: 'project-two' } },
    ];

    expect(scopeMyTaskItems(projectItems, 'project-two').map(({ id }) => id)).toEqual(['two']);
    expect(scopeMyTaskItems(projectItems, null)).toEqual(projectItems);
  });
});
