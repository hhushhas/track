import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One placeholder row. Screens use `SkeletonList` so assistive technology
 * hears "loading" once instead of once per row.
 */
export function SkeletonRow() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.7 : 0.4);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { backgroundColor: theme.backgroundElement }, animStyle]}>
      <View style={[styles.avatar, { backgroundColor: theme.skeleton }]} />
      <View style={styles.lines}>
        <View style={[styles.lineWide, { backgroundColor: theme.skeleton }]} />
        <View style={[styles.lineNarrow, { backgroundColor: theme.skeleton }]} />
      </View>
    </Animated.View>
  );
}

/** A labelled run of placeholder rows, announced once as a busy region. */
export function SkeletonList({ count = 4, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: Radius.medium,
    height: 44,
    width: 44,
  },
  lineNarrow: {
    borderRadius: Radius.pill,
    height: 10,
    width: '40%',
  },
  lineWide: {
    borderRadius: Radius.pill,
    height: 12,
    width: '60%',
  },
  lines: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  list: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  row: {
    alignItems: 'center',
    borderRadius: Radius.large,
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
