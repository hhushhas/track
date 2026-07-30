import { describe, expect, it } from 'vitest';

import { isThemeOverride, resolveTheme } from './theme-preference';

describe('theme preference', () => {
  it('resolves explicit overrides without depending on the system theme', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('tracks the system theme and falls back to light', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', null)).toBe('light');
  });

  it('rejects invalid persisted values', () => {
    expect(isThemeOverride('system')).toBe(true);
    expect(isThemeOverride('sepia')).toBe(false);
    expect(isThemeOverride(null)).toBe(false);
  });
});
