import { describe, expect, it } from 'vitest';

import { buildMyTaskSections, type SectionableTask } from './my-task-sections';

function task(dueDate: string | undefined, category: NonNullable<SectionableTask['state']>['category'], updatedAt: number): SectionableTask {
  return { state: { category }, task: { dueDate, updatedAt } };
}

describe('mobile My Tasks sections', () => {
  it('groups open work by the next decision and keeps completed work separate', () => {
    const sections = buildMyTaskSections([
      task('2026-09-17', 'started', 1),
      task('2026-09-18', 'unstarted', 2),
      task('2026-09-22', 'backlog', 3),
      task(undefined, 'started', 4),
      task('2026-09-16', 'completed', 5),
      task('2026-09-15', 'canceled', 6),
    ], '2026-09-18');

    expect(sections.map(({ key }) => key)).toEqual(['overdue', 'today', 'upcoming', 'unscheduled', 'completed']);
    expect(sections.map(({ data }) => data.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it('omits empty sections and sorts undated work after dated work', () => {
    const dated = task('2026-09-19', 'started', 1);
    const undated = task(undefined, 'started', 2);
    const sections = buildMyTaskSections([undated, dated], '2026-09-18');

    expect(sections.map(({ key }) => key)).toEqual(['upcoming', 'unscheduled']);
    expect(sections[0].data).toEqual([dated]);
    expect(sections[1].data).toEqual([undated]);
  });
});
