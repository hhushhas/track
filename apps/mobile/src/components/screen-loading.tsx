import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenLoadingVariant = 'inbox' | 'chats' | 'projects' | 'project' | 'tasks' | 'task';

const COPY: Record<ScreenLoadingVariant, { detail: string; icon: IconName; title: string }> = {
  inbox: { detail: 'Gathering updates that need your attention', icon: 'inbox', title: 'Opening Inbox' },
  chats: { detail: 'Finding your latest conversations', icon: 'message', title: 'Loading chats' },
  projects: { detail: 'Finding Projects you can access', icon: 'project', title: 'Loading Projects' },
  project: { detail: 'Bringing this Project and its work together', icon: 'project', title: 'Opening Project' },
  tasks: { detail: 'Gathering your assigned work', icon: 'task', title: 'Loading tasks' },
  task: { detail: 'Opening task details and recent updates', icon: 'task', title: 'Opening task' },
};

/** A compact, branded progress state for screen-level first loads. */
export function ScreenLoading({ compact = false, variant }: { compact?: boolean; variant: ScreenLoadingVariant }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const firstRing = useSharedValue(0);
  const secondRing = useSharedValue(0);
  const copy = COPY[variant];

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(firstRing);
      cancelAnimation(secondRing);
      firstRing.value = 1;
      secondRing.value = 1;
      return;
    }

    firstRing.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), -1);
    secondRing.value = withRepeat(withDelay(700, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) })), -1);
    return () => {
      cancelAnimation(firstRing);
      cancelAnimation(secondRing);
    };
  }, [firstRing, reduceMotion, secondRing]);

  const firstRingStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.22 : 0.28 * (1 - firstRing.value),
    transform: [{ scale: reduceMotion ? 1 : 0.72 + firstRing.value * 0.65 }],
  }));
  const secondRingStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.12 : 0.2 * (1 - secondRing.value),
    transform: [{ scale: reduceMotion ? 1.08 : 0.72 + secondRing.value * 0.65 }],
  }));

  return (
    <View
      accessibilityLabel={`${copy.title}. ${copy.detail}`}
      accessibilityRole="progressbar"
      style={[styles.container, compact && styles.compact]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mark, compact && styles.compactMark]}>
        <Animated.View style={[styles.ring, { borderColor: theme.accentStrong }, firstRingStyle]} />
        <Animated.View style={[styles.ring, { borderColor: theme.accentStrong }, secondRingStyle]} />
        <View style={[styles.iconPlate, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name={copy.icon} size={27} weight="medium" />
        </View>
      </View>
      <View style={styles.copy}>
        <ThemedText accessibilityElementsHidden type="subtitle">{copy.title}</ThemedText>
        <ThemedText accessibilityElementsHidden style={{ color: theme.textSecondary, textAlign: 'center' }} type="small">{copy.detail}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { minHeight: 224 },
  compactMark: { height: 82, width: 82 },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 300, paddingHorizontal: Spacing.four },
  copy: { alignItems: 'center', gap: Spacing.one, marginTop: Spacing.four, maxWidth: 280 },
  iconPlate: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, height: 60, justifyContent: 'center', width: 60 },
  mark: { alignItems: 'center', height: 108, justifyContent: 'center', width: 108 },
  ring: { borderRadius: Radius.pill, borderWidth: 1.5, height: 74, position: 'absolute', width: 74 },
});
