export type TaskDecision = {
  icon: 'check-circle' | 'play' | 'refresh';
  label: string;
  prompt: string;
  targetCategory: 'started' | 'completed' | 'unstarted';
};

type TaskCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' | string | undefined;

/** Keeps the task detail's first action focused on the next useful decision. */
export function taskDecisionForCategory(category: TaskCategory): TaskDecision {
  if (category === 'completed' || category === 'canceled') {
    return { icon: 'refresh', label: 'Reopen task', prompt: 'Move this task to the first open status and record the change.', targetCategory: 'unstarted' };
  }
  if (category === 'started') {
    return { icon: 'check-circle', label: 'Mark complete', prompt: 'Move this task to the first completed status and record the change.', targetCategory: 'completed' };
  }
  return { icon: 'play', label: 'Start task', prompt: 'Move this task to the first active status and record the change.', targetCategory: 'started' };
}
