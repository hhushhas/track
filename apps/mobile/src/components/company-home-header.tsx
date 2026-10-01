import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { companyMarkColors } from '@/lib/company-brand';
import { getHomeGreeting } from '@/lib/home-greeting';

export function CompanyHomeHeader({
  companyName,
  companySeed,
  displayName,
  notificationCount,
  onCompany,
  onNotifications,
  onProfile,
  profileSeed,
  timeZone,
}: {
  companyName: string;
  companySeed: string;
  displayName: string;
  notificationCount: number;
  onCompany: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  profileSeed: string;
  timeZone?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  const countLabel = notificationCount > 99 ? '99+' : String(notificationCount);
  const companyTone = companyMarkColors(companySeed, theme);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityHint="Opens the Company selector"
          accessibilityLabel={`Current workspace: ${companyName}`}
          accessibilityRole="button"
          onPress={onCompany}
          style={({ pressed }) => [
            styles.company,
            { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder, opacity: pressed ? 0.7 : 1 },
          ]}>
          <View style={[styles.companyMark, { backgroundColor: companyTone.background }]}>
            <PlatformIcon color={companyTone.foreground} name="office-building" size={IconSize.large} weight="semibold" />
          </View>
          <View style={styles.companyCopy}>
            <View style={styles.companyTitleRow}>
              <ThemedText numberOfLines={1} style={styles.companyTitle} type="title">{companyName}</ThemedText>
              <PlatformIcon color={theme.textSecondary} name="chevron-down" size={IconSize.small} weight="semibold" />
            </View>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">Active Company</ThemedText>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={notificationCount ? `${notificationCount} notifications in ${companyName}` : `No notifications in ${companyName}`}
            accessibilityRole="button"
            onPress={onNotifications}
            style={({ pressed }) => [styles.action, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder, opacity: pressed ? 0.65 : 1 }]}>
            <PlatformIcon color={theme.text} name="bell-outline" size={IconSize.large} />
            {notificationCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.homeBackground }]}>
                <ThemedText style={[styles.badgeText, { color: theme.accentInk }]} type="captionBold">{countLabel}</ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={onProfile}
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
            <ColoredAvatar label={displayName} seed={profileSeed} size={TouchTarget} />
          </Pressable>
        </View>
      </View>

      <View style={styles.greeting}>
        <ThemedText
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={[styles.greetingTitle, width < 375 && styles.greetingTitleSmall]}
          type="display">
          {getHomeGreeting(now, timeZone)}, {firstName}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    height: TouchTarget, justifyContent: 'center', width: TouchTarget,
  },
  actions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  badge: {
    alignItems: 'center', borderRadius: Radius.pill, borderWidth: 2, height: 20, justifyContent: 'center',
    minHeight: 24, minWidth: 24, paddingHorizontal: 4, paddingVertical: 2, position: 'absolute', right: -4, top: -5,
  },
  badgeText: Typography.captionBold,
  company: {
    alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth,
    flex: 1, flexDirection: 'row', gap: Spacing.three, maxWidth: 250, minHeight: TouchTarget, paddingRight: Spacing.three,
  },
  companyCopy: { flex: 1, gap: 1, minWidth: 0 },
  companyMark: {
    alignItems: 'center', alignSelf: 'stretch', borderBottomLeftRadius: Radius.large, borderTopLeftRadius: Radius.large,
    justifyContent: 'center', width: 52,
  },
  companyTitle: { flexShrink: 1 },
  companyTitleRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  greeting: { gap: Spacing.one },
  greetingTitle: Typography.display,
  greetingTitleSmall: Typography.display,
  root: { gap: Spacing.five },
  toolbar: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, justifyContent: 'space-between' },
});
