/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';

export function useTheme() {
  const { theme } = useThemeOverride();

  return Colors[theme];
}
