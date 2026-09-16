import { useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  style?: Parameters<typeof Animated.View>[0]['style'];
};

/** A single, quiet reveal for a screen or newly selected content block. */
export function ScreenEntrance({ children, style }: Props) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? 140 : 260,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reduceMotion ? 0 : (1 - progress.value) * 10 },
      { scale: reduceMotion ? 1 : 0.985 + progress.value * 0.015 },
    ],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
