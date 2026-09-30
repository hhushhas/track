import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ConversationLoadingProps = {
  label?: string;
  variant?: 'conversation' | 'thread';
};

type PlaceholderRow = {
  align: 'left' | 'right';
  first: DimensionValue;
  second: DimensionValue;
};

/** Keeps the message rhythm visible while an authorized conversation is loading. */
export function ConversationLoading({
  label = 'Loading conversation',
  variant = 'conversation',
}: ConversationLoadingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.72 : 0.45);
  const rows: PlaceholderRow[] = variant === 'thread'
    ? [
        { align: 'left' as const, first: '72%', second: '48%' },
        { align: 'right' as const, first: '58%', second: '34%' },
        { align: 'left' as const, first: '64%', second: '42%' },
      ]
    : [
        { align: 'left' as const, first: '68%', second: '44%' },
        { align: 'right' as const, first: '54%', second: '32%' },
        { align: 'left' as const, first: '76%', second: '48%' },
        { align: 'right' as const, first: '62%', second: '38%' },
      ];

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.72;
      return;
    }
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.container}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.contextPlaceholder}>
        <View style={[styles.contextIcon, { backgroundColor: theme.skeleton }]} />
        <View style={[styles.contextLine, { backgroundColor: theme.skeleton }]} />
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.messages}>
        {rows.map((row, index) => (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            key={`${row.align}-${index}`}
            style={[styles.messageRow, row.align === 'right' && styles.messageRowRight, animatedStyle]}>
            {row.align === 'left' ? <View style={[styles.avatar, { backgroundColor: theme.skeleton }]} /> : <View style={styles.avatarSpacer} />}
            <View style={[styles.bubble, row.align === 'right' && styles.bubbleOwn, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
              <View style={[styles.line, { backgroundColor: theme.skeleton, width: row.first }]} />
              <View style={[styles.line, { backgroundColor: theme.skeleton, width: row.second }]} />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: Radius.pill, height: 36, width: 36 },
  avatarSpacer: { width: 36 },
  bubble: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, maxWidth: '78%', minHeight: 62, padding: Spacing.three, width: '72%' },
  bubbleOwn: { alignItems: 'flex-end' },
  container: { flex: 1, gap: Spacing.five, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  contextIcon: { borderRadius: Radius.medium, height: 36, width: 36 },
  contextLine: { borderRadius: Radius.pill, height: 14, width: '44%' },
  contextPlaceholder: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  line: { borderRadius: Radius.pill, height: 11 },
  messageRow: { alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two },
  messageRowRight: { justifyContent: 'flex-end' },
  messages: { gap: Spacing.three },
});
