import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';

import splashIcon from '@/assets/images/splash-icon.png';

const MARK_SIZE = 360;
const SPLASH_BACKGROUND = '#000000';

/** Native-matched startup artwork with a short, interruptible handoff to the app. */
export function LaunchScreen({ exiting = false, onExitComplete, onReady }: { exiting?: boolean; onExitComplete?: () => void; onReady?: () => void }) {
  const didLoadImage = useRef(false);
  const didLayout = useRef(false);
  const didReportReady = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const animation = Animated.parallel([
      Animated.timing(opacity, { duration: reduceMotion ? 0 : 240, toValue: 0, useNativeDriver: true }),
      Animated.timing(scale, { duration: reduceMotion ? 0 : 240, toValue: 1.035, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onExitComplete?.();
    });
    return () => animation.stop();
  }, [exiting, onExitComplete, opacity, reduceMotion, scale]);

  const reportReady = useCallback(() => {
    if (didReportReady.current || !didLayout.current || !didLoadImage.current) return;
    didReportReady.current = true;
    onReady?.();
  }, [onReady]);

  return (
    <View
      onLayout={() => {
        didLayout.current = true;
        reportReady();
      }}
      style={[styles.screen, { backgroundColor: SPLASH_BACKGROUND }]}
    >
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          onLoadEnd={() => {
            didLoadImage.current = true;
            reportReady();
          }}
          resizeMode="contain"
          source={splashIcon}
          style={styles.mark}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { height: MARK_SIZE, width: MARK_SIZE },
  screen: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
