import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The assistant's stand-in for an avatar. It sits in the same gutter a member
 * avatar occupies, so an assistant answer keeps the incoming bubble rhythm.
 */
export function AssistantMark({ size = 32 }: { size?: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { backgroundColor: theme.accentSoft, borderRadius: Radius.pill, height: size, width: size }]}>
      <ThemedText style={[styles.letter, { color: theme.accentStrong, fontSize: size * 0.44 }]} type="captionBold">
        T
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  letter: {
    textAlign: 'center',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
