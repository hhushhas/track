const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid.*(credential|password)|credential.*invalid/i, 'The email or password is incorrect.'],
  [/email.*(invalid|not valid)/i, 'Enter a valid email address.'],
  [/already.*(exist|registered)|user.*exist/i, 'An account already exists for this email.'],
  [/network|fetch|offline|timed?\s*out|connection/i, 'Track could not connect. Check your connection and try again.'],
  [/too many|rate.?limit/i, 'There were too many attempts. Wait a moment and try again.'],
];

const TASK_MESSAGES: Array<[RegExp, string]> = [
  [/task_access_changed/i, 'Your access changed. Refresh and try again.'],
  [/task_duplicate_decision_required/i, 'Choose whether to add evidence or create a separate task.'],
  [/not[_ ]allowed|forbidden|unauthori[sz]ed/i, 'You no longer have permission to make this change.'],
  [/revision|conflict/i, 'This task changed elsewhere. Refresh it and try again.'],
  [/network|fetch|offline|timed?\s*out|connection/i, 'Track could not connect. Your changes were not lost; try again when you are online.'],
];

function mappedMessage(failure: unknown, messages: Array<[RegExp, string]>, fallback: string) {
  const raw = failure instanceof Error ? failure.message : '';
  return messages.find(([pattern]) => pattern.test(raw))?.[1] ?? fallback;
}

/** Never exposes provider, Convex, HTTP, or internal error text in account UI. */
export function accountErrorMessage(failure: unknown, fallback = 'Track could not complete that account action. Please try again.') {
  return mappedMessage(failure, AUTH_MESSAGES, fallback);
}

/** Stable task copy for mutation and synchronization failures. */
export function taskErrorMessage(failure: unknown, fallback = 'The task could not be updated. Check your connection and try again.') {
  return mappedMessage(failure, TASK_MESSAGES, fallback);
}

export function communicationErrorMessage(failure: unknown, action = 'save this change') {
  const raw = failure instanceof Error ? failure.message : '';
  if (/access|permission|not_allowed|forbidden|unauthor/i.test(raw)) {
    return 'Your access changed. Refresh and try again.';
  }
  if (/conflict|revision|changed_elsewhere/i.test(raw)) {
    return 'This conversation changed elsewhere. Refresh and try again.';
  }
  if (/network|offline|fetch|timeout|connection/i.test(raw)) {
    return `You appear to be offline. Reconnect to ${action}.`;
  }
  return `We couldn’t ${action}. Please try again.`;
}

export function notificationErrorMessage(failure: unknown) {
  const raw = failure instanceof Error ? failure.message : '';
  if (/expo.?go/i.test(raw)) {
    return 'Remote notifications require a Track development or release build.';
  }
  if (/firebaseapp|firebase.*initiali[sz]|google-services|fis_auth|default firebase app/i.test(raw)) {
    return 'This Android build is missing its Firebase notification configuration. Install a current Track build and try again.';
  }
  if (/denied|permission/i.test(raw)) {
    return 'Notifications are disabled for Track in your device settings.';
  }
  if (/network|offline|fetch|timeout|connection/i.test(raw)) {
    return 'Notification setup needs an internet connection.';
  }
  return 'Notification setup is unavailable right now. Please try again.';
}
