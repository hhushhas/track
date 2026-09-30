import { describe, expect, it } from 'vitest';

import { matchesMyTaskFilter, matchesMyTaskFilters, matchesMyTaskSearch } from './my-task-filters';

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

  it('applies Status, Priority, and Due date together using the selected week boundaries', () => {
    const dueToday = { ...task, task: { ...task.task, dueDate: '2026-09-30', priority: 'urgent' } };
    const filters = { status: 'open', priority: 'urgent', dueDate: 'thisWeek' } as const;

    expect(matchesMyTaskFilters(dueToday, filters, '2026-09-30', '2026-10-04')).toBe(true);
    expect(matchesMyTaskFilters({ ...dueToday, task: { ...dueToday.task, dueDate: '2026-09-29' } }, filters, '2026-09-30', '2026-10-04')).toBe(false);
    expect(matchesMyTaskFilters({ ...dueToday, task: { ...dueToday.task, priority: 'high' } }, filters, '2026-09-30', '2026-10-04')).toBe(false);
    expect(matchesMyTaskFilters({ ...dueToday, state: { category: 'completed' } }, filters, '2026-09-30', '2026-10-04')).toBe(false);
  });

  it('keeps completed and canceled tasks out of the default status scope', () => {
    const defaultFilters = { status: 'all', priority: 'all', dueDate: 'all' } as const;

    expect(matchesMyTaskFilters(task, defaultFilters, '2026-09-30', '2026-10-04')).toBe(true);
    expect(matchesMyTaskFilters({ ...task, state: { category: 'completed' } }, defaultFilters, '2026-09-30', '2026-10-04')).toBe(true);
    expect(matchesMyTaskFilters({ ...task, state: { category: 'canceled' } }, defaultFilters, '2026-09-30', '2026-10-04')).toBe(false);
    expect(matchesMyTaskFilters({ ...task, state: { category: 'completed' } }, { ...defaultFilters, status: 'completed' }, '2026-09-30', '2026-10-04')).toBe(true);
  });
});
