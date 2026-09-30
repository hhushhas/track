import { describe, expect, it } from 'vitest';

import { taskDueDisplay } from './task-presentation';

describe('taskDueDisplay', () => {
  it('shows the actual due date for overdue tasks so the list remains actionable', () => {
    const result = taskDueDisplay('2026-09-28', '2026-09-30', 'started');

    expect(result?.overdue).toBe(true);
    expect(result?.label).toMatch(/^Overdue · /);
    expect(result?.label).toContain('28');
  });
});
