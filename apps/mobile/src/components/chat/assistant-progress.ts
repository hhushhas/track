export type AssistantProgressStage =
  | 'completed'
  | 'failed'
  | 'finalizing'
  | 'loading_context'
  | 'queued'
  | 'reading_attachments'
  | 'running'
  | 'waiting_provider';

export type AssistantErrorCode = 'attachment' | 'provider' | 'timeout' | 'unavailable' | 'unknown';

export function assistantProgressLabel(
  status: 'completed' | 'failed' | 'queued' | 'running',
  stage?: AssistantProgressStage,
) {
  switch (stage ?? status) {
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Could not finish';
    case 'finalizing':
      return 'Finishing with grounded sources';
    case 'loading_context':
      return 'Loading project context';
    case 'queued':
      return 'Starting';
    case 'reading_attachments':
      return 'Reading attached evidence';
    case 'running':
      return 'Thinking';
    case 'waiting_provider':
      return 'Waiting for Track AI';
  }
  return 'Thinking';
}

export function assistantFailureHint(errorCode?: AssistantErrorCode) {
  if (errorCode === 'unavailable') return 'This channel is no longer available. Check access and try again.';
  if (errorCode === 'timeout') return 'Track AI took too long to respond. Ask again to retry.';
  return 'Track could not finish. Ask again to retry.';
}
