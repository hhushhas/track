import { describe, expect, it } from 'vitest';

import {
  accountErrorMessage,
  communicationErrorMessage,
  notificationErrorMessage,
  taskErrorMessage,
} from './user-facing-error';

describe('user-facing errors', () => {
  it('maps provider and transport failures without exposing raw text', () => {
    expect(accountErrorMessage(new Error('INVALID_CREDENTIALS: provider detail'))).toBe('The email or password is incorrect.');
    expect(accountErrorMessage(new Error('fetch failed: https://internal.example'))).toBe('Track could not connect. Check your connection and try again.');
  });

  it('maps task policy failures and uses a stable fallback', () => {
    expect(taskErrorMessage(new Error('task_access_changed'))).toBe('Your access changed. Refresh and try again.');
    expect(taskErrorMessage(new Error('internal_database_failure'))).toBe('The task could not be updated. Check your connection and try again.');
  });


  it('keeps communication and notification failures actionable', () => {
    expect(communicationErrorMessage(new Error('server_trace_123'), 'rename this thread'))
      .toBe('We couldn’t rename this thread. Please try again.');
    expect(notificationErrorMessage(new Error('permission_denied')))
      .toBe('Notifications are disabled for Track in your device settings.');
    expect(notificationErrorMessage(new Error('Default FirebaseApp is not initialized in this process')))
      .toBe('This Android build is missing its Firebase notification configuration. Install a current Track build and try again.');
    expect(notificationErrorMessage(new Error('Unavailable in Expo Go')))
      .toBe('Remote notifications require a Track development or release build.');
  });
});
