import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight, hapticDestructive } from '@/lib/haptics';

type Action = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void };

type Props = { visible: boolean; onClose: () => void; actions: Action[] };

export function MessageActions({ visible, onClose, actions }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: theme.overlay }]}
      />
      <ThemedView style={[styles.sheet, { borderTopColor: theme.hairline }]}>
        <View style={[styles.handle, { backgroundColor: theme.textSecondary }]} />
        <View style={styles.content}>
          {actions.map((action) => (
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: theme.backgroundSelected }}
              key={action.label}
              onPress={() => {
                if (action.destructive) {
                  hapticDestructive();
                } else {
                  hapticLight();
                }
                onClose();
                action.onPress();
              }}
              style={styles.row}>
              {action.icon && (
                <PlatformIcon
                  color={action.destructive ? theme.danger : theme.textSecondary}
                  name={action.icon}
                  size={22}
                />
              )}
              <ThemedText
                style={{ color: action.destructive ? theme.danger : theme.text }}
                type="smallBold">
                {action.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={{ height: insets.bottom }} />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  handle: { alignSelf: 'center', borderRadius: Radius.small, height: 4, marginBottom: Spacing.two, opacity: 0.5, width: 36 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: TouchTarget + Spacing.one,
    paddingVertical: Spacing.two,
  },
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    position: 'absolute',
    right: 0,
  },
});
