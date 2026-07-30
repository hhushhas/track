import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

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
    void SecureStore.getItemAsync(STORE_KEY).then((saved) => {
      const value = isThemeOverride(saved) ? saved : 'system';
      setThemeOverrideState(value);
      Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    });
  }, []);

  const setThemeOverride = useCallback((value: ThemeOverride) => {
    setThemeOverrideState(value);
    Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    void SecureStore.setItemAsync(STORE_KEY, value);
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
