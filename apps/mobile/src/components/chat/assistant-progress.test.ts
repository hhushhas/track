import { describe, expect, it } from 'vitest';

import { assistantFailureHint, assistantProgressLabel } from './assistant-progress';

describe('assistant progress presentation', () => {
  it('keeps progress labels honest and terminal states explicit', () => {
    expect(assistantProgressLabel('running', 'reading_attachments')).toBe('Reading attached evidence');
    expect(assistantProgressLabel('completed')).toBe('Done');
    expect(assistantProgressLabel('failed')).toBe('Could not finish');
  });

  it('gives timeout failures a concrete recovery action', () => {
    expect(assistantFailureHint('timeout')).toContain('Ask again to retry');
  });
});
