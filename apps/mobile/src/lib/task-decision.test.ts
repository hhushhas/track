import { describe, expect, it } from 'vitest';

import { taskDecisionForCategory } from './task-decision';

describe('taskDecisionForCategory', () => {
  it('starts work that has not started', () => {
    expect(taskDecisionForCategory('unstarted')).toMatchObject({ label: 'Start task', icon: 'play', targetCategory: 'started' });
  });

  it('offers completion for active work', () => {
    expect(taskDecisionForCategory('started')).toMatchObject({ label: 'Mark complete', icon: 'check-circle', targetCategory: 'completed' });
  });

  it('offers reopening for terminal work', () => {
    expect(taskDecisionForCategory('completed')).toMatchObject({ label: 'Reopen task', icon: 'refresh', targetCategory: 'unstarted' });
    expect(taskDecisionForCategory('canceled')).toMatchObject({ label: 'Reopen task', icon: 'refresh', targetCategory: 'unstarted' });
  });
});
