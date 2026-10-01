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
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ConversationLoadingProps = {
  label?: string;
  variant?: 'conversation' | 'thread';
};

/** Shows a brief, branded conversation animation while chat data is opening. */
export function ConversationLoading({
  label,
  variant = 'conversation',
}: ConversationLoadingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const backBubble = useSharedValue(0);
  const frontBubble = useSharedValue(0);
  const title = variant === 'thread' ? 'Opening thread' : 'Opening conversation';

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(backBubble);
      cancelAnimation(frontBubble);
      backBubble.value = 1;
      frontBubble.value = 1;
      return;
    }

    backBubble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    frontBubble.value = withRepeat(
      withSequence(
        withDelay(170, withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.25)) })),
        withTiming(0, { duration: 690, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );

    return () => {
      cancelAnimation(backBubble);
      cancelAnimation(frontBubble);
    };
  }, [backBubble, frontBubble, reducedMotion]);

  const backBubbleStyle = useAnimatedStyle(() => ({
    opacity: 0.58 + backBubble.value * 0.42,
    transform: [
      { translateX: (1 - backBubble.value) * 7 },
      { translateY: backBubble.value * -3 },
      { scale: 0.94 + backBubble.value * 0.06 },
    ],
  }));
  const frontBubbleStyle = useAnimatedStyle(() => ({
    opacity: 0.76 + frontBubble.value * 0.24,
    transform: [
      { translateY: 5 - frontBubble.value * 5 },
      { scale: 0.92 + frontBubble.value * 0.08 },
    ],
  }));

  return (
    <View
      accessibilityLabel={label ?? title}
      accessibilityRole="progressbar"
      style={styles.container}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.illustration}>
        <Animated.View
          style={[
            styles.backBubble,
            { backgroundColor: theme.accentSoft },
            backBubbleStyle,
          ]}>
          <View style={[styles.backMessageDot, { backgroundColor: theme.accentStrong }]} />
          <View style={[styles.tail, styles.backTail, { backgroundColor: theme.accentSoft }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.frontBubble,
            { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder },
            frontBubbleStyle,
          ]}>
          <View style={styles.dots}>
            <PulseDot color={theme.accentStrong} delay={0} reducedMotion={reducedMotion} />
            <PulseDot color={theme.accentStrong} delay={135} reducedMotion={reducedMotion} />
            <PulseDot color={theme.accentStrong} delay={270} reducedMotion={reducedMotion} />
          </View>
          <View style={[styles.tail, styles.frontTail, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]} />
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <ThemedText accessibilityElementsHidden type="subtitle">{title}</ThemedText>
        <ThemedText accessibilityElementsHidden style={{ color: theme.textSecondary }} type="small">
          Bringing the latest messages into view
        </ThemedText>
      </View>
    </View>
  );
}

function PulseDot({ color, delay, reducedMotion }: { color: string; delay: number; reducedMotion: boolean }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(lift);
      lift.value = 0;
      return;
    }

    lift.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1, { duration: 230, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        withDelay(450, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(lift);
  }, [delay, lift, reducedMotion]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + lift.value * 0.5,
    transform: [{ translateY: -lift.value * 4 }, { scale: 0.86 + lift.value * 0.24 }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

const styles = StyleSheet.create({
  backBubble: {
    borderRadius: Radius.large,
    height: 48,
    left: 77,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    top: 9,
    width: 72,
  },
  backMessageDot: { borderRadius: Radius.pill, height: 9, marginTop: 7, width: 9 },
  backTail: { left: 14 },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  copy: { alignItems: 'center', gap: Spacing.one, marginTop: Spacing.four },
  dot: { borderRadius: Radius.pill, height: 9, width: 9 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  frontBubble: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Radius.xlarge,
    borderWidth: StyleSheet.hairlineWidth,
    height: 64,
    justifyContent: 'center',
    left: 22,
    position: 'absolute',
    top: 39,
    width: 104,
  },
  frontTail: { borderBottomLeftRadius: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, left: 20 },
  illustration: { height: 112, position: 'relative', width: 164 },
  tail: { bottom: -4, height: 9, position: 'absolute', transform: [{ rotate: '-45deg' }], width: 9 },
});
