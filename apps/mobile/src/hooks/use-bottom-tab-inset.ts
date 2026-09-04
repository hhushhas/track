import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

/** Physical height reserved by the persistent app navigation, including its minimum safe-area pad. */
export function useBottomTabBarInset() {
  const insets = useSafeAreaInsets();
  return BottomTabInset + Math.max(insets.bottom, Spacing.two);
}

/** Content reserve for screens that render the persistent primary navigation. */
export function useBottomTabContentInset(extra = Spacing.four) {
  return useBottomTabBarInset() + extra;
}
