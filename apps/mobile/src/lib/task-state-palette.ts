import type { TaskStateCategory } from '@track/shared/tasks';

import type { Colors } from '@/constants/theme';

type Theme = Record<keyof typeof Colors.light, string>;

export type TaskStateTheme = Pick<Theme,
  | 'backgroundElement'
  | 'text'
  | 'textSecondary'
  | 'workflowBacklog'
  | 'workflowBacklogSoft'
  | 'workflowBacklogStrong'
  | 'workflowCanceled'
  | 'workflowCanceledSoft'
  | 'workflowCanceledStrong'
  | 'workflowCompleted'
  | 'workflowCompletedSoft'
  | 'workflowCompletedStrong'
  | 'workflowStarted'
  | 'workflowStartedSoft'
  | 'workflowStartedStrong'
  | 'workflowUnstarted'
  | 'workflowUnstartedSoft'
  | 'workflowUnstartedStrong'
>;

export type TaskStatePalette = {
  background: string;
  foreground: string;
  strong: string;
};

export function taskStatePalette(theme: TaskStateTheme, category?: TaskStateCategory): TaskStatePalette {
  switch (category) {
    case 'backlog':
      return {
        background: theme.workflowBacklogSoft,
        foreground: theme.workflowBacklog,
        strong: theme.workflowBacklogStrong,
      };
    case 'unstarted':
      return {
        background: theme.workflowUnstartedSoft,
        foreground: theme.workflowUnstarted,
        strong: theme.workflowUnstartedStrong,
      };
    case 'started':
      return {
        background: theme.workflowStartedSoft,
        foreground: theme.workflowStarted,
        strong: theme.workflowStartedStrong,
      };
    case 'completed':
      return {
        background: theme.workflowCompletedSoft,
        foreground: theme.workflowCompleted,
        strong: theme.workflowCompletedStrong,
      };
    case 'canceled':
      return {
        background: theme.workflowCanceledSoft,
        foreground: theme.workflowCanceled,
        strong: theme.workflowCanceledStrong,
      };
    default:
      return {
        background: theme.backgroundElement,
        foreground: theme.textSecondary,
        strong: theme.text,
      };
  }
}
