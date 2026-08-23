import { describe, expect, it } from 'vitest';

import { hasUsableStoredAuthSession } from './auth-storage-core';

const now = Date.parse('2026-05-23T12:00:00.000Z');

describe('hasUsableStoredAuthSession', () => {
  it('accepts an unexpired native cookie or cached session', () => {
    expect(hasUsableStoredAuthSession({
      cookie: JSON.stringify({
        'better-auth.session_token': {
          value: 'token',
          expires: '2026-05-23T13:00:00.000Z',
        },
      }),
      sessionCache: null,
    }, now)).toBe(true);

    expect(hasUsableStoredAuthSession({
      cookie: null,
      sessionCache: JSON.stringify({
        user: { id: 'user_123' },
        session: { id: 'session_123', expiresAt: '2026-05-23T13:00:00.000Z' },
      }),
    }, now)).toBe(true);
  });

  it('rejects missing or expired stored auth data', () => {
    expect(hasUsableStoredAuthSession({
      cookie: JSON.stringify({
        'better-auth.session_token': {
          value: 'token',
          expires: '2026-05-23T11:00:00.000Z',
        },
      }),
      sessionCache: JSON.stringify({
        user: { id: 'user_123' },
        session: { id: 'session_123', expiresAt: '2026-05-23T11:00:00.000Z' },
      }),
    }, now)).toBe(false);
  });
});
