import { StyleSheet, View } from 'react-native';

import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  title: string;
  body?: string;
};

export function EmptyState({ icon, title, body }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <PlatformIcon color={theme.textSecondary} name={icon} size={28} />
      </View>
      <ThemedText style={styles.title} type="title">
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.body} themeColor="textSecondary" type="caption">
          {body}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { lineHeight: 18, textAlign: 'center' },
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
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },
});
