import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, IconSize, Radius, Spacing } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { useReleaseConfig } from '@/lib/release-config';

type PrimaryDestination = {
  key: 'today' | 'inbox' | 'projects' | 'tasks';
  label: string;
  icon: IconName;
  href: string;
};

type Props = {
  tasksHref?: string;
  /** Kept for call-site compatibility; threads is rendered contextually in Channels. */
  threadsHref?: string;
};

/** Stable work-area navigation; detail screens remain in the stack above it. */
export function PrimaryNavigation(_props: Props) {
  const theme = useTheme();
  const release = useReleaseConfig();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  // Keep the primary destinations stable. Threads belongs inside a Channel
  // because its meaning depends on the message/channel context.
  const destinations: PrimaryDestination[] = [
    { key: 'today', label: 'Home', icon: 'calendar-today', href: '/today' },
    { key: 'projects', label: 'Projects', icon: 'briefcase-outline', href: '/projects' },
    ...(release.tasks ? [{ key: 'tasks' as const, label: 'Tasks', icon: 'check-circle' as const, href: '/tasks' }] : []),
    { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/inbox' },
  ];

  return (
    <View style={[styles.shell, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}> 
      <View accessibilityRole="tablist" style={styles.row}>
        {destinations.map((destination) => {
          const selected = destination.key === 'today'
            ? pathname === '/today' || pathname === '/'
            : pathname === destination.href.split('?')[0];
          return (
            <Pressable
              accessibilityLabel={destination.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={destination.key}
              onPress={() => {
                if (selected) return;
                hapticLight();
                router.replace(destination.href as never);
              }}
              style={styles.item}>
              <View style={[styles.icon, selected && { backgroundColor: theme.accentSoft }]}>
                <PlatformIcon color={selected ? theme.accentStrong : theme.textSecondary} name={destination.icon} size={IconSize.medium} />
              </View>
              <ThemedText themeColor={selected ? 'accentStrong' : 'textSecondary'} type="captionBold">{destination.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', borderRadius: Radius.pill, height: 32, justifyContent: 'center', minWidth: 44, paddingHorizontal: Spacing.two },
  item: { alignItems: 'center', flex: 1, gap: 2, minHeight: 54, paddingTop: Spacing.one },
  row: { flexDirection: 'row', paddingHorizontal: Spacing.one },
  shell: { borderTopWidth: StyleSheet.hairlineWidth, bottom: 0, elevation: 12, left: 0, minHeight: BottomTabInset, paddingTop: Spacing.one, position: 'absolute', right: 0, shadowColor: '#000', shadowOffset: { height: -2, width: 0 }, shadowOpacity: 0.08, shadowRadius: 8, zIndex: 20 },
});
