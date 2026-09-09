import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePaginatedQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { api } from '../../../../convex/_generated/api';
import { BottomTabInset, Colors, IconSize, Radius, Spacing } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { useReleaseConfig } from '@/lib/release-config';
import {
  primaryDestinationForRoute,
  primaryTabGeometry,
  primaryTabIndexAtX,
  primaryTabRubberBand,
  primaryTabResetTarget,
} from '@/lib/primary-navigation';
import { uniqueAttentionItems, type MobileAttentionItem } from '@/lib/mobile-attention';

const spring = { duration: 280, dampingRatio: 0.86, reduceMotion: ReduceMotion.System } as const;

/** Global peer navigation. Each destination owns an independent nested stack. */
export function PrimaryNavigation({ navigation, state }: BottomTabBarProps) {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const keyboardVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const insets = useSafeAreaInsets();
  const { trackUserId } = useTrackUser();
  const release = useReleaseConfig();
  const reduceMotion = useReducedMotion();
  const [reduceTransparency, setReduceTransparency] = useState<boolean | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorLeft = useSharedValue(0);
  const indicatorLift = useSharedValue(0);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const indicatorWidth = useSharedValue(0);
  const indicatorDragging = useSharedValue(0);
  const isIos = Platform.OS === 'ios';

  const attentionPages = usePaginatedQuery(api.mobile.listAttention, trackUserId
    ? { userId: trackUserId }
    : 'skip', { initialNumItems: 10 });
  const attentionCount = uniqueAttentionItems(attentionPages.results as MobileAttentionItem[]).length;
  const destinations = state.routes.map((route) => primaryDestinationForRoute(route.name, !release.tasks));
  const selectedIndex = state.index;
  const disabledDestinationIndex = destinations.findIndex((destination) => destination.disabled);
  const glassAvailable = isIos && reduceTransparency === false && safeGlassAvailability();

  useEffect(() => {
    if (!isIos) return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, [isIos]);

  useEffect(() => {
    if (!rowWidth) return;
    if (indicatorDragging.get()) return;
    const geometry = primaryTabGeometry(rowWidth, destinations.length, selectedIndex);
    const { cellWidth, indicatorLeft: targetLeft, indicatorWidth: restingWidth } = geometry;
    const currentLeft = indicatorLeft.get();
    const distance = Math.abs(targetLeft - currentLeft);

    if (!indicatorWidth.get() || reduceMotion) {
      cancelAnimation(indicatorLeft);
      cancelAnimation(indicatorLift);
      cancelAnimation(indicatorScaleX);
      cancelAnimation(indicatorScaleY);
      cancelAnimation(indicatorWidth);
      indicatorLeft.set(targetLeft);
      indicatorLift.set(0);
      indicatorScaleX.set(1);
      indicatorScaleY.set(1);
      indicatorWidth.set(restingWidth);
      return;
    }

    cancelAnimation(indicatorLeft);
    cancelAnimation(indicatorLift);
    cancelAnimation(indicatorScaleX);
    cancelAnimation(indicatorScaleY);
    cancelAnimation(indicatorWidth);
    const stretchedWidth = restingWidth + Math.min(distance, cellWidth * 1.35);

    if (targetLeft >= currentLeft) {
      indicatorLeft.set(withDelay(78, withSpring(targetLeft, spring)));
    } else {
      indicatorLeft.set(withSpring(targetLeft, spring));
    }
    indicatorWidth.set(withSequence(
      withTiming(stretchedWidth, { duration: 118, reduceMotion: ReduceMotion.System }),
      withSpring(restingWidth, spring),
    ));
    indicatorScaleY.set(withSequence(
      withTiming(0.88, { duration: 105, reduceMotion: ReduceMotion.System }),
      withSpring(1, spring),
    ));
    indicatorLift.set(withSequence(
      withTiming(-2, { duration: 105, reduceMotion: ReduceMotion.System }),
      withSpring(0, spring),
    ));
  }, [destinations.length, indicatorDragging, indicatorLeft, indicatorLift, indicatorScaleX, indicatorScaleY, indicatorWidth, isIos, reduceMotion, rowWidth, selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorLeft.get() },
      { translateY: indicatorLift.get() },
      { scaleX: indicatorScaleX.get() },
      { scaleY: indicatorScaleY.get() },
    ],
    width: indicatorWidth.get(),
  }));

  function onRowLayout(event: LayoutChangeEvent) {
    setRowWidth(event.nativeEvent.layout.width);
  }

  const activateDestination = useCallback((index: number, withHaptic = true) => {
    const destination = destinations[index];
    const route = state.routes[index];
    if (!destination || !route || destination.disabled) return;
    if (withHaptic) hapticLight();
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    const resetTarget = primaryTabResetTarget(destination.key);
    if (resetTarget) {
      navigation.navigate(route.name, resetTarget);
      return;
    }
    if (index !== selectedIndex) navigation.navigate(route.name, route.params);
  }, [destinations, navigation, selectedIndex, state.routes]);

  const iosDragGesture = useMemo(() => Gesture.Pan()
    .enabled(isIos && rowWidth > 0 && !reduceMotion)
    .activateAfterLongPress(180)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      const cellWidth = rowWidth / destinations.length;
      const restingWidth = Math.max(48, cellWidth - Spacing.two);
      indicatorDragging.set(1);
      cancelAnimation(indicatorLeft);
      cancelAnimation(indicatorLift);
      cancelAnimation(indicatorScaleX);
      cancelAnimation(indicatorScaleY);
      cancelAnimation(indicatorWidth);
      indicatorWidth.set(restingWidth);
      indicatorLift.set(withSpring(0, spring));
      indicatorScaleX.set(withSpring(reduceMotion ? 1 : 1.14, spring));
      indicatorScaleY.set(withSpring(reduceMotion ? 1 : 1.14, spring));
      scheduleOnRN(hapticLight);
    })
    .onUpdate((event) => {
      const cellWidth = rowWidth / destinations.length;
      const restingWidth = Math.max(48, cellWidth - Spacing.two);
      const horizontalStretch = reduceMotion ? 0 : Math.min(Math.abs(event.velocityX) / 7_000, 0.12);
      const verticalStretch = reduceMotion ? 0 : Math.min(Math.abs(event.velocityY) / 8_000, 0.08);
      const horizontalScale = reduceMotion ? 1 : 1.14 + horizontalStretch;
      const verticalScale = reduceMotion ? 1 : 1.14 + verticalStretch - horizontalStretch * 0.22;
      const proposedLeft = event.x - restingWidth / 2;
      const restingInset = (cellWidth - restingWidth) / 2;
      indicatorLeft.set(primaryTabRubberBand(
        proposedLeft,
        restingInset,
        rowWidth - restingWidth - restingInset,
        Spacing.four,
      ));
      if (reduceMotion) return;
      indicatorLift.set(primaryTabRubberBand(
        event.translationY,
        -Spacing.three,
        Spacing.three,
        Spacing.two,
      ));
      indicatorScaleX.set(horizontalScale);
      indicatorScaleY.set(verticalScale);
    })
    .onEnd((event) => {
      const cellWidth = rowWidth / destinations.length;
      const restingWidth = Math.max(48, cellWidth - Spacing.two);
      const projectedX = event.x + event.velocityX * 0.04;
      let destinationIndex = primaryTabIndexAtX(projectedX, rowWidth, destinations.length);
      if (destinationIndex === disabledDestinationIndex) destinationIndex = selectedIndex;
      const targetLeft = destinationIndex * cellWidth + (cellWidth - restingWidth) / 2;
      indicatorDragging.set(0);
      indicatorLeft.set(withSpring(targetLeft, { ...spring, velocity: event.velocityX }));
      indicatorLift.set(withSpring(0, spring));
      indicatorScaleX.set(withSpring(1, spring));
      indicatorScaleY.set(withSpring(1, spring));
      indicatorWidth.set(withSpring(restingWidth, spring));
      scheduleOnRN(activateDestination, destinationIndex, false);
    })
    .onFinalize((_event, success) => {
      if (success) return;
      const cellWidth = rowWidth / destinations.length;
      const restingWidth = Math.max(48, cellWidth - Spacing.two);
      const targetLeft = selectedIndex * cellWidth + (cellWidth - restingWidth) / 2;
      indicatorDragging.set(0);
      indicatorLeft.set(withSpring(targetLeft, spring));
      indicatorLift.set(withSpring(0, spring));
      indicatorScaleX.set(withSpring(1, spring));
      indicatorScaleY.set(withSpring(1, spring));
      indicatorWidth.set(withSpring(restingWidth, spring));
    }), [
    activateDestination,
    destinations.length,
    disabledDestinationIndex,
    indicatorDragging,
    indicatorLeft,
    indicatorLift,
    indicatorScaleX,
    indicatorScaleY,
    indicatorWidth,
    isIos,
    reduceMotion,
    rowWidth,
    selectedIndex,
  ]);

  if (keyboardVisible) return null;

  const tabItems = destinations.map((destination, index) => {
    const route = state.routes[index];
    const selected = index === selectedIndex;
    const badge = destination.key === 'home' ? attentionCount : 0;
    const accessibilityLabel = badge
      ? destination.label + ', ' + (badge > 99 ? '99 plus' : badge) + ' items needing attention'
      : destination.label;

    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="tab"
        accessibilityState={{ disabled: destination.disabled, selected }}
        disabled={destination.disabled}
        key={route.key}
        onLongPress={isIos ? undefined : () => navigation.emit({ type: 'tabLongPress', target: route.key })}
        onPress={() => activateDestination(index)}
        style={({ pressed }) => [
          styles.item,
          { opacity: destination.disabled ? 0.42 : pressed ? 0.62 : 1 },
        ]}
      >
        <View style={[
          styles.icon,
          !isIos && styles.androidIcon,
          !isIos && selected && { backgroundColor: theme.accentSoft },
        ]}>
          <PlatformIcon
            color={selected ? theme.accentStrong : theme.textSecondary}
            name={destination.icon}
            size={IconSize.large}
          />
          {badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.badgeText} type="captionBold">
                {badge > 99 ? '99+' : badge}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText
          themeColor={selected ? 'accentStrong' : 'textSecondary'}
          type="captionBold"
        >
          {destination.label}
        </ThemedText>
      </Pressable>
    );
  });

  if (!isIos) {
    return (
      <View style={[styles.androidPositioner, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundElevated }]}
        />
        <View
          accessibilityRole="tablist"
          style={[styles.androidRow, { borderColor: theme.hairline }]}
        >
          {tabItems}
        </View>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.iosPositioner, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <IosChromeSurface glassAvailable={glassAvailable}>
        {glassAvailable ? (
          <GlassView
            colorScheme={themeName}
            glassEffectStyle="regular"
            isInteractive={false}
            pointerEvents="none"
            style={styles.pillFill}
            tintColor={theme.navigationGlass}
          />
        ) : reduceTransparency !== false ? (
          <View
            pointerEvents="none"
            style={[styles.pillFill, { backgroundColor: theme.backgroundElevated }]}
          />
        ) : (
          <View pointerEvents="none" style={[styles.pillFill, styles.blurClip]}>
            <BlurView
              intensity={72}
              pointerEvents="none"
              style={[styles.pillFill, { backgroundColor: theme.navigationGlass }]}
              tint={themeName === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
            />
          </View>
        )}
        <View
          pointerEvents="none"
          style={[styles.iosChromeBorder, { borderColor: theme.hairline }]}
        />
        <GestureDetector gesture={iosDragGesture}>
          <View accessibilityRole="tablist" onLayout={onRowLayout} style={styles.iosRow}>
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={[styles.iosIndicator, indicatorStyle]}
            >
              {glassAvailable ? (
                <GlassView
                  colorScheme={themeName}
                  glassEffectStyle="clear"
                  isInteractive={false}
                  pointerEvents="none"
                  style={styles.pillFill}
                  tintColor={theme.navigationSelectionGlass}
                />
              ) : reduceTransparency !== false ? (
                <View
                  pointerEvents="none"
                  style={[styles.pillFill, { backgroundColor: theme.accentSoft }]}
                />
              ) : (
                <View pointerEvents="none" style={[styles.pillFill, styles.blurClip]}>
                  <BlurView
                    intensity={46}
                    pointerEvents="none"
                    style={[styles.pillFill, { backgroundColor: theme.navigationSelectionGlass }]}
                    tint={themeName === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                  />
                </View>
              )}
            </Animated.View>
            {tabItems}
          </View>
        </GestureDetector>
      </IosChromeSurface>
    </View>
  );
}

function IosChromeSurface({ children, glassAvailable }: { children: ReactNode; glassAvailable: boolean }) {
  if (glassAvailable) {
    return (
      <GlassContainer spacing={Spacing.three} style={styles.iosChrome}>
        {children}
      </GlassContainer>
    );
  }
  return <View style={styles.iosChrome}>{children}</View>;
}

function safeGlassAvailability() {
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  androidIcon: { borderRadius: Radius.pill, height: 32 },
  androidPositioner: { minHeight: BottomTabInset, overflow: 'hidden' },
  androidRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: Spacing.one,
    position: 'relative',
  },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: Spacing.one,
    position: 'absolute',
    right: -8,
    top: -7,
  },
  badgeText: { color: Colors.light.text, fontSize: 10, lineHeight: 14 },
  blurClip: { overflow: 'hidden' },
  icon: { alignItems: 'center', height: 28, justifyContent: 'center', minWidth: 44 },
  iosChrome: {
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
    boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
    minHeight: BottomTabInset,
    overflow: 'visible',
    position: 'relative',
  },
  iosChromeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iosIndicator: {
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
    bottom: Spacing.one,
    boxShadow: '0 4px 14px rgba(240,177,0,0.18)',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: Spacing.one,
  },
  iosPositioner: {
    backgroundColor: 'transparent',
    bottom: 0,
    left: 0,
    overflow: 'visible',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    right: 0,
    zIndex: 50,
  },
  iosRow: { flexDirection: 'row', overflow: 'visible', position: 'relative' },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
    minHeight: BottomTabInset,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
    zIndex: 1,
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
  },
});
