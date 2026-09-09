import { useNetworkState } from 'expo-network';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Quiet, shared connectivity state for reading and triage screens. */
export function ConnectivityBanner({ message = 'You’re offline. Showing saved content when available.', style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  const network = useNetworkState();
  const theme = useTheme();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }, style]}>
      <PlatformIcon color={theme.accentStrong} name="cloud-off" size={18} />
      <ThemedText style={styles.message} themeColor="textSecondary" type="small">{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  message: { flex: 1 },
});
