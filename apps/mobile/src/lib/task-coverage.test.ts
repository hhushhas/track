import { describe, expect, it } from 'vitest';

import { taskCoverageStatus } from './task-coverage';

describe('taskCoverageStatus', () => {
  it('waits until the assigned-task and week queries both load their first page', () => {
    expect(taskCoverageStatus('LoadingFirstPage', 'Exhausted')).toBe('loading');
    expect(taskCoverageStatus('Exhausted', 'LoadingFirstPage')).toBe('loading');
  });

  it('reports incomplete Company coverage while either query has more Project pages', () => {
    expect(taskCoverageStatus('CanLoadMore', 'Exhausted')).toBe('partial');
    expect(taskCoverageStatus('Exhausted', 'CanLoadMore')).toBe('partial');
  });

  it('reports a Project task cap as partial even after Company pagination ends', () => {
    expect(taskCoverageStatus('Exhausted', 'Exhausted', true)).toBe('partial');
  });

  it('reports a weekly Project task cap as partial even after Project pagination ends', () => {
    expect(taskCoverageStatus('Exhausted', 'Exhausted', false, true)).toBe('partial');
  });

  it('waits for an active page request before offering another load action', () => {
    expect(taskCoverageStatus('LoadingMore', 'CanLoadMore')).toBe('loadingMore');
  });

  it('reports complete coverage only after both queries are exhausted', () => {
    expect(taskCoverageStatus('Exhausted', 'Exhausted')).toBe('complete');
  });
});
