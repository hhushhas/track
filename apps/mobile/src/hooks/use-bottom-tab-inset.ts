import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

/** Exact iOS overlay height; Android navigation continues to participate in layout. */
export function useBottomTabBarInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios') return 0;
  return BottomTabInset + Spacing.two + Math.max(insets.bottom, Spacing.two);
}

/** Keeps the final row reachable above the floating iOS glass navigation. */
export function useBottomTabContentInset(extra = Spacing.four) {
  return useBottomTabBarInset() + extra;
}
