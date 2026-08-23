import { describe, expect, it } from 'vitest';

import { requiresTwoFactor, validateEmailSignIn, validateEmailSignUp } from './email-auth';

describe('email auth validation', () => {
  it('enforces the sign-in and sign-up validation contract', () => {
    expect(validateEmailSignIn(' Reviewer@Track.Q9Labs.AI ', 'secret')).toEqual({
      ok: true,
      email: 'reviewer@track.q9labs.ai',
    });
    expect(validateEmailSignIn('reviewer', 'secret')).toEqual({
      ok: false,
      error: 'Enter a valid email address.',
    });
    expect(validateEmailSignIn('reviewer@track.q9labs.ai', '')).toEqual({
      ok: false,
      error: 'Enter your password.',
    });

    expect(validateEmailSignUp(' Hasan Shoaib ', ' Reviewer@Track.Q9Labs.AI ', 'longenough123')).toEqual({
      ok: true,
      email: 'reviewer@track.q9labs.ai',
      name: 'Hasan Shoaib',
    });
    expect(validateEmailSignUp('  ', 'reviewer@track.q9labs.ai', 'longenough123')).toEqual({
      ok: false,
      error: 'Enter your name.',
    });
    expect(validateEmailSignUp('Hasan', 'reviewer', 'longenough123')).toEqual({
      ok: false,
      error: 'Enter a valid email address.',
    });
    expect(validateEmailSignUp('Hasan', 'reviewer@track.q9labs.ai', 'short')).toEqual({
      ok: false,
      error: 'Use a password of at least 10 characters.',
    });
  });
});

describe('requiresTwoFactor', () => {
  it('recognizes a Better Auth two-factor redirect', () => {
    expect(requiresTwoFactor({ twoFactorRedirect: true })).toBe(true);
    expect(requiresTwoFactor({ user: { id: 'user' } })).toBe(false);
    expect(requiresTwoFactor(null)).toBe(false);
  });
});
