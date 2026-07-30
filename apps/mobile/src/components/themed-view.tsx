import { View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const { theme: themeName } = useThemeOverride();
  const theme = useTheme();
  const overrideColor = themeName === 'dark' ? darkColor : lightColor;

  return (
    <View
      style={[{ backgroundColor: overrideColor ?? theme[type ?? 'background'] }, style]}
      {...otherProps}
    />
  );
}
