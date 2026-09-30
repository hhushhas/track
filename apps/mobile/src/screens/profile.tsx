import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { ColoredAvatar } from '@/components/colored-avatar';
import { SheetFieldButton, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PlatformIcon } from '@/components/platform-icon';
import { TimezonePicker } from '@/components/timezone-picker';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { deviceTimezone, findTimezone } from '@/lib/timezones';
import { hapticLight } from '@/lib/haptics';

function timezoneLabel(id: string) {
  const zone = findTimezone(id);
  return zone ? `${zone.flag} ${zone.city} · ${zone.countryName}` : id;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const bottomContentInset = useBottomTabContentInset(Spacing.six);
  const { themeOverride, setThemeOverride } = useThemeOverride();
  const { trackUserId, signOut, isSigningOut } = useTrackUser();
  const profile = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const updateProfile = useMutation(api.auth.updateProfile);
  const [displayName, setDisplayName] = useState('');
  const [designation, setDesignation] = useState('');
  const [timezone, setTimezone] = useState(deviceTimezone());
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.user) return;
    setDisplayName(profile.user.displayName ?? '');
    setDesignation(profile.user.profileDesignation ?? '');
    setTimezone(profile.user.timezone ?? deviceTimezone());
  }, [profile?.user]);

  async function save() {
    if (!trackUserId || !displayName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ userId: trackUserId, displayName: displayName.trim(), profileDesignation: designation.trim(), timezone, profileBannerStyle: 'silk' });
    } catch {
      setError('Profile changes were not saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return <ThemedView style={[styles.screen, { paddingTop: safeAreaInsets.top, paddingLeft: safeAreaInsets.left, paddingRight: safeAreaInsets.right }]}>
    <Stack.Screen options={{ title: 'Profile', headerShown: false }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="never">
      <ConnectivityBanner />
      <View style={styles.profileHeader}>
        <ThemedText style={styles.pageTitle} type="display">Profile</ThemedText>
      </View>
      <View style={[styles.identityCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
        <ColoredAvatar label={displayName || profile?.user?.email || 'Track member'} seed={trackUserId ?? displayName} size={56} />
        <View style={styles.identityCopy}>
          <ThemedText numberOfLines={1} style={styles.identityText} type="titleLarge">{displayName || 'Track member'}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.identityText} themeColor="textSecondary" type="caption">{profile?.user?.email ?? 'Account details'}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.identityText} themeColor="textTertiary" type="caption">{designation.trim() || 'Add your role'}</ThemedText>
        </View>
      </View>
      <View style={[styles.profileFields, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
        <ThemedText type="subtitle">Your details</ThemedText>
        <SheetInput label="Name" maxLength={100} onChangeText={setDisplayName} value={displayName} />
        <SheetInput label="Designation" maxLength={100} onChangeText={setDesignation} value={designation} />
        <SheetFieldButton icon="earth" label="Timezone" onPress={() => setTimezoneOpen(true)} value={timezoneLabel(timezone)} />
        {error ? <ThemedText accessibilityRole="alert" themeColor="danger" type="small">{error}</ThemedText> : null}
        <ActionButton disabled={saving || !displayName.trim()} label="Save profile" loading={saving} onPress={() => void save()} />
      </View>
      <View style={[styles.preferenceCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}><SheetSection title="Preferences">
        <SheetRow icon="bell-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <SheetRow icon="shield-check" label="Company access" onPress={() => router.push('/company')} />
      </SheetSection></View>
      <View style={[styles.appearance, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
        <ThemedText type="subtitle">Appearance</ThemedText>
        <View style={[styles.appearanceOptions, { backgroundColor: theme.backgroundElement }]}>
          {([
            ['system', 'System', 'theme-light-dark'],
            ['light', 'Light', 'white-balance-sunny'],
            ['dark', 'Dark', 'moon-waning-crescent'],
          ] as const).map(([value, label, icon]) => <Pressable
            accessibilityLabel={`${label} appearance`}
            accessibilityRole="radio"
            accessibilityState={{ checked: themeOverride === value }}
            key={value}
            onPress={() => { hapticLight(); setThemeOverride(value); }}
            style={({ pressed }) => [styles.appearanceOption, { backgroundColor: themeOverride === value ? theme.homeSurface : 'transparent', borderColor: themeOverride === value ? theme.homeBorder : 'transparent', opacity: pressed ? 0.75 : 1 }]}
          ><PlatformIcon color={themeOverride === value ? theme.text : theme.textSecondary} name={icon} size={16} /><ThemedText numberOfLines={1} themeColor={themeOverride === value ? 'text' : 'textSecondary'} type="captionBold">{label}</ThemedText></Pressable>)}
        </View>
      </View>
      <View style={[styles.signOut, { borderTopColor: theme.homeBorder }]}><ActionButton disabled={isSigningOut} label="Sign out" loading={isSigningOut} onPress={() => void signOut()} variant="secondary" /></View>
    </ScrollView>
    <TimezonePicker onClose={() => setTimezoneOpen(false)} onSelect={(value) => { setTimezone(value); setTimezoneOpen(false); }} value={timezone} visible={timezoneOpen} />
  </ThemedView>;
}

const styles = StyleSheet.create({
  appearance: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.three, padding: Spacing.four },
  appearanceOption: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: Spacing.one, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  appearanceOptions: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, padding: Spacing.one },
  content: { gap: Spacing.four, padding: Spacing.four },
  identityCard: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  identityCopy: { alignItems: 'center', gap: Spacing.one, maxWidth: '100%' },
  identityText: { maxWidth: '100%', textAlign: 'center' },
  pageTitle: { textAlign: 'center' },
  preferenceCard: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  profileHeader: { alignItems: 'center', gap: Spacing.three },
  profileFields: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.three, padding: Spacing.four },
  screen: { flex: 1 },
  signOut: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.four },
});
