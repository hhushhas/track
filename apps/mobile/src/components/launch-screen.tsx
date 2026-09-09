import { useCallback, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import trackMarkDark from '@/assets/images/track-mark-reversed.png';
import trackMarkLight from '@/assets/images/track-mark.png';
import { useThemeOverride } from '@/contexts/theme-override-context';

const MARK_SIZE = 180;
const SPLASH_BACKGROUND = { dark: '#000000', light: '#faf9f7' } as const;

/** Pixel-matched startup artwork shown while the existing session flow resolves. */
export function LaunchScreen({ onReady }: { onReady?: () => void }) {
  const { theme: themeName } = useThemeOverride();
  const didLoadImage = useRef(false);
  const didLayout = useRef(false);
  const didReportReady = useRef(false);
  const source = themeName === 'dark' ? trackMarkDark : trackMarkLight;

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
      style={[styles.screen, { backgroundColor: SPLASH_BACKGROUND[themeName] }]}
    >
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        onLoadEnd={() => {
          didLoadImage.current = true;
          reportReady();
        }}
        resizeMode="contain"
        source={source}
        style={styles.mark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { height: MARK_SIZE, width: MARK_SIZE },
  screen: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
