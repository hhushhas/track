import { describe, expect, it } from 'vitest';

import { requiresTwoFactor, validateEmailSignIn, validateEmailSignUp } from './email-auth';

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

describe('validateEmailSignUp', () => {
  it('normalizes the name and email', () => {
    expect(validateEmailSignUp(' Hasan Shoaib ', ' Reviewer@Track.Q9Labs.AI ', 'longenough123')).toEqual({
      ok: true,
      email: 'reviewer@track.q9labs.ai',
      name: 'Hasan Shoaib',
    });
  });

  it('requires a name', () => {
    expect(validateEmailSignUp('  ', 'reviewer@track.q9labs.ai', 'longenough123')).toEqual({
      ok: false,
      error: 'Enter your name.',
    });
  });

  it('rejects invalid email addresses', () => {
    expect(validateEmailSignUp('Hasan', 'reviewer', 'longenough123')).toEqual({
      ok: false,
      error: 'Enter a valid email address.',
    });
  });

  it('enforces the server minimum password length', () => {
    expect(validateEmailSignUp('Hasan', 'reviewer@track.q9labs.ai', 'short')).toEqual({
      ok: false,
      error: 'Use a password of at least 10 characters.',
    });
  });
});

describe('requiresTwoFactor', () => {
  it('recognizes a Better Auth two-factor redirect', () => {
    expect(requiresTwoFactor({ twoFactorRedirect: true })).toBe(true);
  });

  it('rejects ordinary sign-in responses', () => {
    expect(requiresTwoFactor({ user: { id: 'user' } })).toBe(false);
    expect(requiresTwoFactor(null)).toBe(false);
  });
});
