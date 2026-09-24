import { usePathname } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { primaryNavigationHeight, primaryNavigationVisibleForPath } from '@/lib/primary-navigation';

/** Exact floating navigation height on both platforms. */
export function useBottomTabBarInset() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { fontScale } = useWindowDimensions();
  if (!primaryNavigationVisibleForPath(pathname)) return 0;
  return primaryNavigationHeight(fontScale, BottomTabInset) + Spacing.two + Math.max(insets.bottom, Spacing.two);
}

/** Keeps the final row reachable above the floating glass navigation. */
export function useBottomTabContentInset(extra: number = Spacing.four) {
  return useBottomTabBarInset() + extra;
}
