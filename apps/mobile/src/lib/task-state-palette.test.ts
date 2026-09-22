import { describe, expect, it } from 'vitest';

import { taskStatePalette, type TaskStateTheme } from './task-state-palette';

const lightTheme: TaskStateTheme = {
  backgroundElement: '#element-light',
  text: '#text-light',
  textSecondary: '#secondary-light',
  workflowBacklog: '#backlog-light',
  workflowBacklogSoft: '#backlog-soft-light',
  workflowBacklogStrong: '#backlog-strong-light',
  workflowCanceled: '#canceled-light',
  workflowCanceledSoft: '#canceled-soft-light',
  workflowCanceledStrong: '#canceled-strong-light',
  workflowCompleted: '#completed-light',
  workflowCompletedSoft: '#completed-soft-light',
  workflowCompletedStrong: '#completed-strong-light',
  workflowStarted: '#started-light',
  workflowStartedSoft: '#started-soft-light',
  workflowStartedStrong: '#started-strong-light',
  workflowUnstarted: '#unstarted-light',
  workflowUnstartedSoft: '#unstarted-soft-light',
  workflowUnstartedStrong: '#unstarted-strong-light',
};

const darkTheme: TaskStateTheme = {
  ...lightTheme,
  backgroundElement: '#element-dark',
  text: '#text-dark',
  textSecondary: '#secondary-dark',
  workflowCompleted: '#completed-dark',
  workflowCompletedSoft: '#completed-soft-dark',
  workflowCompletedStrong: '#completed-strong-dark',
};

describe('taskStatePalette', () => {
  it('keeps each workflow state visually distinct in light mode', () => {
    const palettes = (['backlog', 'unstarted', 'started', 'completed', 'canceled'] as const)
      .map((category) => taskStatePalette(lightTheme, category));

    expect(new Set(palettes.map((palette) => palette.foreground)).size).toBe(5);
    expect(taskStatePalette(lightTheme, 'backlog').foreground).toBe(lightTheme.workflowBacklog);
    expect(taskStatePalette(lightTheme, 'started').foreground).toBe(lightTheme.workflowStarted);
  });

  it('returns the matching dark-mode tokens', () => {
    expect(taskStatePalette(darkTheme, 'completed')).toEqual({
      background: darkTheme.workflowCompletedSoft,
      foreground: darkTheme.workflowCompleted,
      strong: darkTheme.workflowCompletedStrong,
    });
  });

  it('falls back to neutral tokens when a state is missing', () => {
    expect(taskStatePalette(lightTheme)).toEqual({
      background: lightTheme.backgroundElement,
      foreground: lightTheme.textSecondary,
      strong: lightTheme.text,
    });
  });
});
