export type ThemeName = 'light' | 'dark';
export type ThemeOverride = ThemeName | 'system';

export function isThemeOverride(value: string | null): value is ThemeOverride {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(
  override: ThemeOverride,
  systemScheme: string | null | undefined,
): ThemeName {
  if (override !== 'system') return override;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
