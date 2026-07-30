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
      const value = isThemeOverride(saved) ? saved : 'system';
      setThemeOverrideState(value);
      if (Platform.OS !== 'web') {
        Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
      }
    });
  }, []);

  const setThemeOverride = useCallback((value: ThemeOverride) => {
    setThemeOverrideState(value);
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    }
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
