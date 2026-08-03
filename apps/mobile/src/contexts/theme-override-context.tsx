import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';

import { platformStorage } from '@/lib/platform-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  isThemeOverride,
  resolveTheme,
  type ThemeName,
  type ThemeOverride,
} from '@/lib/theme-preference';

const STORE_KEY = 'theme_override';

type ThemeOverrideContextValue = {
  theme: ThemeName;
  themeOverride: ThemeOverride;
  setThemeOverride: (value: ThemeOverride) => void;
};

const ThemeOverrideContext = createContext<ThemeOverrideContextValue>({
  theme: 'light',
  themeOverride: 'system',
  setThemeOverride: () => undefined,
});

export function ThemeOverrideProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeOverride, setThemeOverrideState] = useState<ThemeOverride>('system');

  useEffect(() => {
    void platformStorage.getItemAsync(STORE_KEY).then((saved) => {
      setThemeOverrideState(isThemeOverride(saved) ? saved : 'system');
    });
  }, []);

  /**
   * Native chrome — keyboards, alerts, text selection, scroll indicators — has
   * to follow the app override, so it is pushed to `Appearance`. It is pushed
   * from one effect rather than from the setter and the restore path, so the
   * two cannot disagree about ordering.
   *
   * `Appearance.setColorScheme` mutates the cached scheme without emitting a
   * `change` event, so it never notifies `useColorScheme` subscribers. React
   * state stays the single source of truth for every colour Track draws itself.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(themeOverride === 'system' ? 'unspecified' : themeOverride);
    }
  }, [themeOverride]);

  const setThemeOverride = useCallback((value: ThemeOverride) => {
    setThemeOverrideState(value);
    void platformStorage.setItemAsync(STORE_KEY, value);
  }, []);

  const value = useMemo(() => ({
    theme: resolveTheme(themeOverride, systemScheme),
    themeOverride,
    setThemeOverride,
  }), [setThemeOverride, systemScheme, themeOverride]);

  return (
    <ThemeOverrideContext value={value}>
      {children}
    </ThemeOverrideContext>
  );
}

export function useThemeOverride() {
  return useContext(ThemeOverrideContext);
}
