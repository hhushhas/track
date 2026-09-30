export type TaskPageStatus = 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore';

export type TaskCoverageStatus = 'complete' | 'loading' | 'loadingMore' | 'partial';

export function taskCoverageStatus(assignedStatus: TaskPageStatus, weekStatus: TaskPageStatus, hasCappedProject = false, hasCappedWeek = false): TaskCoverageStatus {
  if (assignedStatus === 'LoadingFirstPage' || weekStatus === 'LoadingFirstPage') return 'loading';
  if (assignedStatus === 'LoadingMore' || weekStatus === 'LoadingMore') return 'loadingMore';
  if (hasCappedProject || hasCappedWeek || assignedStatus === 'CanLoadMore' || weekStatus === 'CanLoadMore') return 'partial';
  return 'complete';
}
