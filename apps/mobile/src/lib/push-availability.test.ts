import { describe, expect, it } from 'vitest';

import { resolvePushAvailability } from './push-availability';

describe('resolvePushAvailability', () => {
  it('requires a development or release build outside Expo Go', () => {
    expect(resolvePushAvailability({ expoGo: true }))
      .toBe('expo_go');
  });

  it('lets a native binary prove its own push capability at runtime', () => {
    expect(resolvePushAvailability({ expoGo: false }))
      .toBe('available');
  });
});
