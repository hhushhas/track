import { describe, expect, it } from 'vitest';

import { matchesMyTaskFilter, matchesMyTaskSearch } from './my-task-filters';

const task = {
  group: { name: 'Design' },
  project: { name: 'Mobile App' },
  state: { category: 'started' },
  task: { priority: 'high', publicKey: 'MOB-18', title: 'Review conversation layout' },
};

describe('My Tasks search and filters', () => {
  it('matches title, task key, Project, and Channel without case sensitivity', () => {
    expect(matchesMyTaskSearch(task, '  REVIEW CONVERSATION ')).toBe(true);
    expect(matchesMyTaskSearch(task, 'mob-18')).toBe(true);
    expect(matchesMyTaskSearch(task, 'mobile app')).toBe(true);
    expect(matchesMyTaskSearch(task, 'design')).toBe(true);
    expect(matchesMyTaskSearch(task, 'missing')).toBe(false);
  });

  it('keeps status and priority filters distinct', () => {
    expect(matchesMyTaskFilter(task, 'all')).toBe(true);
    expect(matchesMyTaskFilter(task, 'open')).toBe(true);
    expect(matchesMyTaskFilter(task, 'completed')).toBe(false);
    expect(matchesMyTaskFilter(task, 'high')).toBe(true);
    expect(matchesMyTaskFilter({ ...task, state: { category: 'completed' } }, 'open')).toBe(false);
    expect(matchesMyTaskFilter({ ...task, state: { category: 'canceled' } }, 'all')).toBe(false);
    expect(matchesMyTaskFilter({ ...task, task: { ...task.task, priority: 'low' } }, 'high')).toBe(false);
  });
});
