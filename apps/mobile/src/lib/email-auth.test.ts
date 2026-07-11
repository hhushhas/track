import { describe, expect, it } from 'vitest';

import { validateEmailSignIn } from './email-auth';

describe('validateEmailSignIn', () => {
  it('normalizes valid email addresses', () => {
    expect(validateEmailSignIn(' Reviewer@Track.Q9Labs.AI ', 'secret')).toEqual({
      ok: true,
      email: 'reviewer@track.q9labs.ai',
    });
  });

  it('rejects invalid email addresses', () => {
    expect(validateEmailSignIn('reviewer', 'secret')).toEqual({
      ok: false,
      error: 'Enter a valid email address.',
    });
  });

  it('requires a password', () => {
    expect(validateEmailSignIn('reviewer@track.q9labs.ai', '')).toEqual({
      ok: false,
      error: 'Enter your password.',
    });
  });
});
