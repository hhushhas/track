import { StyleSheet, View } from 'react-native';

import { PlatformIcon } from '@/components/platform-icon';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  actionLabel?: string;
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  onAction?: () => void;
  tone?: 'neutral' | 'error' | 'offline' | 'success';
  title: string;
  body?: string;
};

export function EmptyState({ actionLabel, icon, onAction, tone = 'neutral', title, body }: Props) {
  const theme = useTheme();
  const foreground = tone === 'error'
    ? theme.danger
    : tone === 'success'
      ? theme.success
      : tone === 'offline'
        ? theme.accentStrong
        : theme.textSecondary;
  return (
    <View
      accessibilityLiveRegion={tone === 'error' || tone === 'offline' ? 'polite' : undefined}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <PlatformIcon color={foreground} name={icon} size={28} />
      </View>
      <ThemedText style={styles.title} type="title">
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.body} themeColor="textSecondary" type="small">
          {body}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <ActionButton label={actionLabel} onPress={onAction} state={tone === 'offline' ? 'offline' : 'default'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: Spacing.one, minWidth: 180 },
  body: { maxWidth: 360, textAlign: 'center' },
  iconWrap: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: { marginTop: Spacing.two, textAlign: 'center' },
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
});
