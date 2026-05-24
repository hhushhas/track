import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

type ThemeOverride = 'light' | 'dark' | 'system';

const STORE_KEY = 'theme_override';

type ThemeOverrideContextValue = {
  themeOverride: ThemeOverride;
  setThemeOverride: (value: ThemeOverride) => void;
};

const ThemeOverrideContext = createContext<ThemeOverrideContextValue>({
  themeOverride: 'system',
  setThemeOverride: () => undefined,
});

export function ThemeOverrideProvider({ children }: { children: React.ReactNode }) {
  const [themeOverride, setThemeOverrideState] = useState<ThemeOverride>('system');

  useEffect(() => {
    void SecureStore.getItemAsync(STORE_KEY).then((saved) => {
      const value = (saved as ThemeOverride | null) ?? 'system';
      setThemeOverrideState(value);
      Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    });
  }, []);

  const setThemeOverride = useCallback((value: ThemeOverride) => {
    setThemeOverrideState(value);
    Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    void SecureStore.setItemAsync(STORE_KEY, value);
  }, []);

  return (
    <ThemeOverrideContext value={{ themeOverride, setThemeOverride }}>
      {children}
    </ThemeOverrideContext>
  );
}

export function useThemeOverride() {
  return useContext(ThemeOverrideContext);
}
