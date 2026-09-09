import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';

type Props = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: IconName;
  loading?: boolean;
  onPress: () => void;
  selected?: boolean;
  size?: number;
};

/** Icon-only control with a platform-sized target and explicit assistive state. */
export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon,
  loading = false,
  onPress,
  selected = false,
  size = 22,
}: Props) {
  const theme = useTheme();
  const unavailable = disabled || loading;
  const color = selected ? theme.accentStrong : theme.textSecondary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable, selected }}
      android_ripple={{ borderless: true, color: theme.backgroundSelected }}
      disabled={unavailable}
      hitSlop={4}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        selected && { backgroundColor: theme.accentSoft },
        { opacity: unavailable ? 0.42 : pressed ? 0.62 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={color} size="small" /> : <PlatformIcon color={color} name={icon} size={size} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
    height: TouchTarget,
    justifyContent: 'center',
    overflow: 'hidden',
    width: TouchTarget,
  },
});
