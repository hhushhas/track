import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import AnimatedReanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import launchArtwork from '@/assets/images/track-launch-concept.png';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';

const SPLASH_BACKGROUND = '#1b1917';
export const LAUNCH_ARTWORK_DURATION_MS = 3000;
const MARK_WIDTH = 148;
const MARK_HEIGHT = 78;
const MARK_SOURCE_SIZE = 512;
const MARK_SOURCE_TOP = (MARK_SOURCE_SIZE - MARK_SOURCE_SIZE * MARK_HEIGHT / MARK_WIDTH) / 2;
const ROUTE_STOPS = [0, 0.34, 0.43, 0.51, 0.62, 1];
const ROUTE_X = [126, 241, 260, 277, 294, 470];
const ROUTE_Y = [355, 355, 349, 333, 300, 300];
const RAIL_PATHS = [
  { side: 'left', targetX: 16, targetY: 140, startOffset: -8, phase: 0, accent: false },
  { side: 'right', targetX: 482, targetY: 218, startOffset: 8, phase: 0.13, accent: false },
  { side: 'left', targetX: 66, targetY: 376, startOffset: -8, phase: 0.26, accent: false },
  { side: 'right', targetX: 503, targetY: 298, startOffset: 8, phase: 0.39, accent: true },
] as const;

type RailPath = (typeof RAIL_PATHS)[number];

/** A brief animated brand intro shown after the static native launch screen. */
export function LaunchScreen({ animationActive = false, exiting = false, onExitComplete, onReady }: { animationActive?: boolean; exiting?: boolean; onExitComplete?: () => void; onReady?: () => void }) {
  const didLoadImage = useRef(false);
  const didLoadMark = useRef(false);
  const didLayout = useRef(false);
  const didReportReady = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const animation = Animated.timing(opacity, { duration: reduceMotion ? 0 : 200, toValue: 0, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) onExitComplete?.();
    });
    return () => animation.stop();
  }, [exiting, onExitComplete, opacity, reduceMotion]);

  const reportReady = useCallback(() => {
    if (didReportReady.current || !didLayout.current || !didLoadImage.current || !didLoadMark.current) return;
    didReportReady.current = true;
    setArtReady(true);
    onReady?.();
  }, [onReady]);

  const reducedMotion = useReducedMotion();
  const routeProgress = useSharedValue(0);
  const railProgress = useSharedValue(0);
  const lockupProgress = useSharedValue(0);
  const wordmarkProgress = useSharedValue(0);
  const arrivalProgress = useSharedValue(0);

  useEffect(() => {
    if (!artReady || !animationActive || exiting) return;
    if (reducedMotion) {
      routeProgress.value = 0;
      railProgress.value = 1;
      lockupProgress.value = 1;
      wordmarkProgress.value = 1;
      arrivalProgress.value = 0;
      return;
    }

    lockupProgress.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    wordmarkProgress.value = withDelay(260, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    railProgress.value = withTiming(1, { duration: 2100, easing: Easing.linear });
    routeProgress.value = withSequence(
      withDelay(400, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) })),
    );
    arrivalProgress.value = withDelay(
      2200,
      withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 360, easing: Easing.in(Easing.cubic) }),
      ),
    );
    return () => {
      cancelAnimation(routeProgress);
      cancelAnimation(railProgress);
      cancelAnimation(lockupProgress);
      cancelAnimation(wordmarkProgress);
      cancelAnimation(arrivalProgress);
    };
  }, [animationActive, artReady, arrivalProgress, exiting, lockupProgress, railProgress, reducedMotion, routeProgress, wordmarkProgress]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: lockupProgress.value,
    transform: [{ scale: 0.9 + lockupProgress.value * 0.1 }, { translateY: (1 - lockupProgress.value) * 8 }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkProgress.value,
    transform: [{ translateY: (1 - wordmarkProgress.value) * 8 }],
  }));
  const tracerStyle = useAnimatedStyle(() => {
    const x = interpolate(routeProgress.value, ROUTE_STOPS, ROUTE_X) / MARK_SOURCE_SIZE * MARK_WIDTH;
    const y = (interpolate(routeProgress.value, ROUTE_STOPS, ROUTE_Y) - MARK_SOURCE_TOP) / MARK_SOURCE_SIZE * MARK_WIDTH;
    const opacity = interpolate(routeProgress.value, [0, 0.01, 0.96, 1], [0, 1, 1, 0]);
    const markLeft = (viewport.width - MARK_WIDTH) / 2;
    const markTop = (viewport.height - MARK_HEIGHT - 44) / 2;

    return {
      opacity: reducedMotion ? 0 : opacity,
      transform: [
        { translateX: markLeft + x - 7 },
        { translateY: markTop + y - 7 },
      ],
    };
  });
  const arrivalStyle = useAnimatedStyle(() => ({
    opacity: arrivalProgress.value,
    transform: [{ scale: 0.65 + arrivalProgress.value * 1.1 }],
  }));
  const markLeft = (viewport.width - MARK_WIDTH) / 2;
  const markTop = (viewport.height - MARK_HEIGHT - 44) / 2;
  const endpointX = markLeft + ROUTE_X[ROUTE_X.length - 1] / MARK_SOURCE_SIZE * MARK_WIDTH;
  const endpointY = markTop + (ROUTE_Y[ROUTE_Y.length - 1] - MARK_SOURCE_TOP) / MARK_SOURCE_SIZE * MARK_WIDTH;

  return (
    <View
      accessibilityLabel="Loading Track"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      onLayout={({ nativeEvent }) => {
        didLayout.current = true;
        setViewport({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
        reportReady();
      }}
      style={[styles.screen, { backgroundColor: SPLASH_BACKGROUND }]}
    >
      <Animated.View style={[styles.artwork, { opacity }]}>
        <Image
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          onLoadEnd={() => {
            didLoadImage.current = true;
            reportReady();
          }}
          resizeMode="cover"
          source={launchArtwork}
          style={styles.backgroundArtwork}
        />
        {viewport.width > 0 ? RAIL_PATHS.map((path) => (
          <AnimatedRailPath key={`${path.side}-${path.targetY}`} path={path} progress={railProgress} viewport={viewport} markLeft={markLeft} markTop={markTop} />
        )) : null}
        <AnimatedReanimated.View
          accessible={false}
          pointerEvents="none"
          style={[styles.lockup, { height: MARK_HEIGHT + 44 }, logoStyle]}
        >
          <Image
            accessible={false}
            accessibilityIgnoresInvertColors
            fadeDuration={0}
            onLoadEnd={() => {
              didLoadMark.current = true;
              reportReady();
            }}
            resizeMode="cover"
            source={trackMarkReversedImage}
            style={styles.mark}
          />
          <AnimatedReanimated.View style={wordmarkStyle}>
            <ThemedText style={styles.wordmark}>Track</ThemedText>
          </AnimatedReanimated.View>
        </AnimatedReanimated.View>
        {!reducedMotion && viewport.width > 0 ? (
          <AnimatedReanimated.View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.tracerHalo, { backgroundColor: Colors.light.accent }, tracerStyle]}
          >
            <View style={styles.tracerCore} />
          </AnimatedReanimated.View>
        ) : null}
        {!reducedMotion && viewport.width > 0 ? (
          <AnimatedReanimated.View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.arrivalHalo, arrivalStyle, { left: endpointX - 12, top: endpointY - 12 }]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  backgroundArtwork: { ...StyleSheet.absoluteFill, height: '100%', width: '100%' },
  lockup: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  mark: { height: MARK_HEIGHT, width: MARK_WIDTH },
  screen: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  wordmark: { color: '#faf9f7', fontSize: 25, fontWeight: '700', letterSpacing: -0.6, lineHeight: 30 },
  arrivalHalo: { borderColor: Colors.light.accentSoft, borderRadius: 12, borderWidth: 1.5, height: 24, position: 'absolute', width: 24 },
  tracerCore: { backgroundColor: Colors.light.accentSoft, borderRadius: 3, height: 6, width: 6 },
  tracerHalo: { alignItems: 'center', borderRadius: 7, height: 14, justifyContent: 'center', position: 'absolute', left: 0, top: 0, width: 14, boxShadow: '0 0 10px rgba(240,177,0,0.6)' },
  rail: { backgroundColor: 'rgba(201,195,184,0.56)', borderRadius: 1, position: 'absolute' },
  accentRail: { backgroundColor: 'rgba(240,177,0,0.86)', borderRadius: 1, position: 'absolute' },
});

function AnimatedRailPath({ path, progress, viewport, markLeft, markTop }: { path: RailPath; progress: SharedValue<number>; viewport: { width: number; height: number }; markLeft: number; markTop: number }) {
  const targetX = markLeft + path.targetX / MARK_SOURCE_SIZE * MARK_WIDTH;
  const targetY = markTop + (path.targetY - MARK_SOURCE_TOP) / MARK_SOURCE_SIZE * MARK_WIDTH;
  const startY = targetY + path.startOffset;
  const turnX = path.side === 'left' ? viewport.width * 0.14 : viewport.width * 0.86;
  const verticalLength = Math.abs(path.startOffset);
  const outerLength = path.side === 'left' ? turnX : viewport.width - turnX;
  const bridgeLength = Math.abs(targetX - turnX);
  const railStyle = path.accent ? styles.accentRail : styles.rail;
  const outerStyle = useAnimatedStyle(() => {
    const phase = Math.max(0, Math.min(1, (progress.value - path.phase) / 0.14));
    return {
      opacity: phase * 0.92,
      transform: [
        { translateX: (path.side === 'left' ? phase - 1 : 1 - phase) * outerLength / 2 },
        { scaleX: phase },
      ],
    };
  });
  const turnStyle = useAnimatedStyle(() => {
    const phase = Math.max(0, Math.min(1, (progress.value - path.phase - 0.12) / 0.08));
    return {
      opacity: phase * 0.92,
      transform: [
        { translateY: (path.startOffset < 0 ? phase - 1 : 1 - phase) * verticalLength / 2 },
        { scaleY: phase },
      ],
    };
  });
  const bridgeStyle = useAnimatedStyle(() => {
    const phase = Math.max(0, Math.min(1, (progress.value - path.phase - 0.2) / 0.22));
    return {
      opacity: phase * 0.92,
      transform: [
        { translateX: (path.side === 'left' ? phase - 1 : 1 - phase) * bridgeLength / 2 },
        { scaleX: phase },
      ],
    };
  });
  return (
    <>
      <AnimatedReanimated.View
        pointerEvents="none"
        style={[railStyle, { height: 1.5, left: path.side === 'left' ? 0 : turnX, top: startY, width: outerLength }, outerStyle]}
      />
      <AnimatedReanimated.View
        pointerEvents="none"
        style={[railStyle, { height: verticalLength, left: turnX - 0.75, top: Math.min(startY, targetY), width: 1.5 }, turnStyle]}
      />
      <AnimatedReanimated.View
        pointerEvents="none"
        style={[railStyle, { height: 1.5, left: path.side === 'left' ? turnX : targetX, top: targetY, width: bridgeLength }, bridgeStyle]}
      />
    </>
  );
}
