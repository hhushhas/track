import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import trackMarkImage from '@/assets/images/track-mark.png';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

/** Keep the brand sequence brief so startup hands off as soon as the app is ready. */
export const LAUNCH_ARTWORK_DURATION_MS = 900;
export const LAUNCH_DISPLAY_DURATION_MS = 980;
const LAUNCH_EXIT_DURATION_MS = 160;

const STAGE_HEIGHT = 128;
const BRAND_TILE_SIZE = 108;
const SOURCE_TILE_SIZE = 52;
const TASK_TILE_WIDTH = 66;
const TASK_TILE_HEIGHT = 56;
const SIGNAL_SIZE = 8;

export function LaunchScreen({ animationActive = false, exiting = false, onExitComplete, onReady, theme = 'light' }: {
  animationActive?: boolean;
  exiting?: boolean;
  onExitComplete?: () => void;
  onReady?: () => void;
  theme?: 'light' | 'dark';
}) {
  const didLoadMark = useRef(false);
  const didLayout = useRef(false);
  const didReportReady = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const [artReady, setArtReady] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const colors = Colors[theme];
  const markSource = theme === 'dark' ? trackMarkReversedImage : trackMarkImage;

  useEffect(() => {
    if (!exiting) return;
    const animation = Animated.timing(opacity, {
      duration: reducedMotion ? 0 : LAUNCH_EXIT_DURATION_MS,
      toValue: 0,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onExitComplete?.();
    });
    return () => animation.stop();
  }, [exiting, onExitComplete, opacity, reducedMotion]);

  const reportReady = useCallback(() => {
    if (didReportReady.current || !didLayout.current || !didLoadMark.current) return;
    didReportReady.current = true;
    setArtReady(true);
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    if (!artReady || !animationActive || exiting || stageWidth === 0) return;
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: LAUNCH_ARTWORK_DURATION_MS, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [animationActive, artReady, exiting, progress, reducedMotion, stageWidth]);

  const logoStyle = useAnimatedStyle(() => {
    const intro = interpolate(progress.value, [0, 0.12, 0.27], [0, 0.72, 1], 'clamp');
    const arrival = interpolate(progress.value, [0.33, 0.43, 0.53, 0.63], [1, 1.035, 1.035, 1], 'clamp');
    const introScale = interpolate(progress.value, [0, 0.27], [0.94, 1], 'clamp');
    return {
      opacity: intro,
      transform: [
        { translateY: interpolate(progress.value, [0, 0.27], [7, 0], 'clamp') },
        { scale: introScale * arrival },
      ],
    };
  });
  const sourceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.04, 0.16, 0.29], [0, 0.82, 1], 'clamp'),
    transform: [{ translateX: interpolate(progress.value, [0.04, 0.25], [-10, 0], 'clamp') }],
  }));
  const leftRouteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.22, 0.38], [0, 0.62, 1], 'clamp'),
    transform: [{ scaleX: interpolate(progress.value, [0.12, 0.39], [0.04, 1], 'clamp') }],
  }));
  const rightRouteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.46, 0.58, 0.77], [0, 0.62, 1], 'clamp'),
    transform: [{ scaleX: interpolate(progress.value, [0.48, 0.78], [0.04, 1], 'clamp') }],
  }));
  const signalStyle = useAnimatedStyle(() => {
    const center = stageWidth / 2;
    const firstArrival = center - BRAND_TILE_SIZE / 2 - SIGNAL_SIZE;
    const secondStart = center + BRAND_TILE_SIZE / 2 + 6;
    const destination = Math.max(SOURCE_TILE_SIZE, stageWidth - TASK_TILE_WIDTH - SIGNAL_SIZE);
    return {
      opacity: interpolate(progress.value, [0.1, 0.16, 0.33, 0.4, 0.49, 0.56, 0.75, 0.82], [0, 1, 1, 0, 0, 1, 1, 0], 'clamp'),
      transform: [{ translateX: interpolate(progress.value, [0.12, 0.39, 0.5, 0.78], [SOURCE_TILE_SIZE, firstArrival, secondStart, destination], 'clamp') }],
    };
  });
  const taskStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 0.58, 0.72], [0, 0.78, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [0.4, 0.7], [9, 0], 'clamp') },
      { scale: interpolate(progress.value, [0.4, 0.7], [0.96, 1], 'clamp') },
    ],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.66, 0.81], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0.66, 0.84], [0.7, 1], 'clamp') }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.05, 0.24], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(progress.value, [0.05, 0.24], [5, 0], 'clamp') }],
  }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 0.73], [0, 1], 'clamp'),
  }));

  const centerRouteLeft = stageWidth / 2 - BRAND_TILE_SIZE / 2;
  const centerRouteRight = stageWidth / 2 + BRAND_TILE_SIZE / 2;
  const leftRouteWidth = Math.max(0, centerRouteLeft - SOURCE_TILE_SIZE);
  const rightRouteWidth = Math.max(0, stageWidth - TASK_TILE_WIDTH - centerRouteRight);

  return (
    <View
      accessibilityLabel="Loading Track"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      onLayout={() => {
        didLayout.current = true;
        reportReady();
      }}
      style={[styles.screen, { backgroundColor: colors.homeBackground }]}
    >
      <Animated.View style={[styles.canvas, { opacity }]}>
        <View style={styles.hero}>
          <View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            onLayout={({ nativeEvent }) => setStageWidth(nativeEvent.layout.width)}
            pointerEvents="none"
            style={styles.stage}
          >
            <View style={[styles.routeBase, { backgroundColor: colors.homeBorder, left: SOURCE_TILE_SIZE, top: STAGE_HEIGHT / 2, width: leftRouteWidth }]} />
            <View style={[styles.routeBase, { backgroundColor: colors.homeBorder, left: centerRouteRight, top: STAGE_HEIGHT / 2, width: rightRouteWidth }]} />
            <Reanimated.View style={[styles.routeActive, { backgroundColor: colors.accent, left: SOURCE_TILE_SIZE, top: STAGE_HEIGHT / 2, width: leftRouteWidth }, leftRouteStyle]} />
            <Reanimated.View style={[styles.routeActive, { backgroundColor: colors.accent, left: centerRouteRight, top: STAGE_HEIGHT / 2, width: rightRouteWidth }, rightRouteStyle]} />
            <Reanimated.View style={[styles.signal, { backgroundColor: colors.accent, top: STAGE_HEIGHT / 2 - SIGNAL_SIZE / 2 }, signalStyle]} />

            <Reanimated.View style={[styles.sourceTile, { backgroundColor: colors.homeSurface, borderColor: colors.homeBorder }, sourceStyle]}>
              <PlatformIcon color={colors.textSecondary} name="message" size={20} />
            </Reanimated.View>

            <Reanimated.View style={[styles.brandTile, { backgroundColor: colors.homeSurface, borderColor: colors.homeBorder }, logoStyle]}>
              <Image
                accessible={false}
                accessibilityIgnoresInvertColors
                fadeDuration={0}
                onLoadEnd={() => {
                  didLoadMark.current = true;
                  reportReady();
                }}
                resizeMode="contain"
                source={markSource}
                style={styles.brandMark}
              />
            </Reanimated.View>

            <Reanimated.View style={[styles.taskTile, { backgroundColor: colors.homeSurface, borderColor: colors.homeBorder }, taskStyle]}>
              <View style={styles.taskTopRow}>
                <View style={[styles.taskCheckbox, { backgroundColor: colors.accentSoft, borderColor: colors.homeBorder }]}>
                  <Reanimated.View style={checkStyle}>
                    <PlatformIcon color={colors.accentStrong} name="check" size={12} />
                  </Reanimated.View>
                </View>
                <View style={styles.taskCopy}>
                  <View style={[styles.taskLinePrimary, { backgroundColor: colors.textSecondary }]} />
                  <View style={[styles.taskLineShort, { backgroundColor: colors.homeBorder }]} />
                </View>
              </View>
              <View style={[styles.taskLineFooter, { backgroundColor: colors.homeBorder }]} />
            </Reanimated.View>
          </View>

          <Reanimated.View style={[styles.wordmarkWrap, wordmarkStyle]}>
            <ThemedText style={[styles.wordmark, { color: colors.text }]} type="titleLarge">Track</ThemedText>
          </Reanimated.View>
          <Reanimated.View style={[styles.captionWrap, captionStyle]}>
            <ThemedText style={[styles.caption, { color: colors.textSecondary }]} type="small">From conversation to action</ThemedText>
          </Reanimated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  canvas: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, transform: [{ translateY: 36 }], width: '100%' },
  stage: { alignItems: 'center', height: STAGE_HEIGHT, justifyContent: 'center', maxWidth: 340, position: 'relative', width: '100%' },
  routeBase: { height: 1.5, position: 'absolute' },
  routeActive: { height: 2, position: 'absolute', transformOrigin: 'left center' },
  signal: { borderRadius: Radius.pill, height: SIGNAL_SIZE, left: 0, position: 'absolute', width: SIGNAL_SIZE, zIndex: 1 },
  sourceTile: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, height: SOURCE_TILE_SIZE, justifyContent: 'center', left: 0, position: 'absolute', top: (STAGE_HEIGHT - SOURCE_TILE_SIZE) / 2, width: SOURCE_TILE_SIZE },
  brandTile: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.xlarge, borderWidth: StyleSheet.hairlineWidth, height: BRAND_TILE_SIZE, justifyContent: 'center', left: '50%', marginLeft: -BRAND_TILE_SIZE / 2, position: 'absolute', top: (STAGE_HEIGHT - BRAND_TILE_SIZE) / 2, width: BRAND_TILE_SIZE, zIndex: 2 },
  brandMark: { height: BRAND_TILE_SIZE - Spacing.two, width: BRAND_TILE_SIZE - Spacing.two },
  taskTile: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, height: TASK_TILE_HEIGHT, justifyContent: 'center', paddingHorizontal: Spacing.two, position: 'absolute', right: 0, top: (STAGE_HEIGHT - TASK_TILE_HEIGHT) / 2, width: TASK_TILE_WIDTH },
  taskTopRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  taskCheckbox: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, height: 16, justifyContent: 'center', width: 16 },
  taskCopy: { flex: 1, gap: 4 },
  taskLinePrimary: { borderRadius: Radius.pill, height: 4, width: '100%' },
  taskLineShort: { borderRadius: Radius.pill, height: 3, width: '62%' },
  taskLineFooter: { borderRadius: Radius.pill, height: 3, marginLeft: 24, marginTop: 7, width: 22 },
  wordmarkWrap: { marginTop: Spacing.two },
  wordmark: { fontWeight: '700', letterSpacing: -0.6, lineHeight: 34 },
  captionWrap: { marginTop: Spacing.three },
  caption: { textAlign: 'center' },
});
