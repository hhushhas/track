import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTheme } from '@/hooks/use-theme';

import trackMarkImage from '@/assets/images/track-mark.png';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';

/**
 * Calm sign-in lockup: one product mark and one sentence, without competing
 * with the account form below it.
 */
export function SignInHero() {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const markSource = themeName === 'dark' ? trackMarkReversedImage : trackMarkImage;

  return (
    <View pointerEvents="none" style={styles.hero}>
      <View style={styles.lockup}>
        <View style={[styles.markTile, { backgroundColor: theme.backgroundElement }]}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={markSource} style={styles.mark} />
          <View
            style={[styles.markStation, { backgroundColor: theme.accent, borderColor: theme.background }]}
          />
        </View>
        <ThemedText style={styles.name}>Track</ThemedText>
        <ThemedText style={[styles.tagline, { color: theme.textSecondary }]} type="small">
          Project communication that keeps teams aligned
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  lockup: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  mark: {
    height: 56,
    width: 56,
  },
  markStation: {
    borderRadius: Radius.medium,
    borderWidth: 3,
    bottom: -5,
    height: 16,
    position: 'absolute',
    right: -5,
    width: 16,
  },
  markTile: {
    alignItems: 'center',
    borderRadius: Radius.xlarge,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  name: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  tagline: {
    maxWidth: 260,
    textAlign: 'center',
  },
});
