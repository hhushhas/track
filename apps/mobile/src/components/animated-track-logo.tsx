import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTheme } from '@/hooks/use-theme';

import trackMarkImage from '@/assets/images/track-mark.png';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';

type AnimatedTrackLogoProps = {
  size?: number;
  showName?: boolean;
  darkSurface?: boolean;
  onReady?: () => void;
};

/** Track's route mark with a quiet amber pulse at the route endpoint. */
export function AnimatedTrackLogo({ size = 64, showName = false, darkSurface = false, onReady }: AnimatedTrackLogoProps) {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const markSource = darkSurface || themeName === 'dark' ? trackMarkReversedImage : trackMarkImage;
  const stationSize = Math.max(8, size * 0.15);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.16 : (1 - pulse.value) * 0.34,
    transform: [{ scale: reducedMotion ? 1 : 0.7 + pulse.value * 1.55 }],
  }));

  return (
    <View accessible={false} style={styles.lockup}>
      <View style={{ height: size, width: size }}>
        <Image
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          onLoadEnd={onReady}
          resizeMode="contain"
          source={markSource}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          importantForAccessibility="no"
          style={[
            styles.ripple,
            {
              borderColor: theme.accent,
              borderRadius: stationSize / 2,
              height: stationSize,
              right: size * 0.025,
              top: size * 0.51,
              width: stationSize,
            },
            rippleStyle,
          ]}
        />
      </View>
      {showName ? <ThemedText style={[styles.name, darkSurface && styles.nameOnDark]}>Track</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', gap: Spacing.three },
  name: { fontSize: 25, fontWeight: '700', letterSpacing: -0.6, lineHeight: 30 },
  nameOnDark: { color: '#faf9f7' },
  ripple: { borderWidth: 1.5, position: 'absolute' },
});
