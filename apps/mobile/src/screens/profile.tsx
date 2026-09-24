import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { ColoredAvatar } from '@/components/colored-avatar';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { deviceTimezone, findTimezone } from '@/lib/timezones';

function timezoneLabel(id: string) {
  const zone = findTimezone(id);
  return zone ? `${zone.flag} ${zone.city} · ${zone.countryName}` : id;
}

export default function ProfileScreen() {
  const theme = useTheme();
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

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ title: 'Profile' }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic">
      <ConnectivityBanner />
      <View style={[styles.identityCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
        <ColoredAvatar label={displayName || profile?.user?.email || 'Track member'} seed={trackUserId ?? displayName} size={64} />
        <View style={styles.flex}><ThemedText type="titleLarge">{displayName || 'Track member'}</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary">{profile?.user?.email ?? 'Account details'}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{profile?.user?.twoFactorEnabled ? 'Two-factor authentication enabled' : 'Password-protected account'}</ThemedText></View>
      </View>
      <SheetSection title="Profile details">
        <SheetInput label="Name" maxLength={100} onChangeText={setDisplayName} value={displayName} />
        <SheetInput label="Designation" maxLength={100} onChangeText={setDesignation} value={designation} />
        <SheetFieldButton icon="earth" label="Timezone" onPress={() => setTimezoneOpen(true)} value={timezoneLabel(timezone)} />
      </SheetSection>
      {error ? <ThemedText accessibilityRole="alert" themeColor="danger" type="small">{error}</ThemedText> : null}
      <ActionButton disabled={saving || !displayName.trim()} label="Save profile" loading={saving} onPress={() => void save()} />
      <SheetSection title="Permissions and alerts">
        <SheetRow detail="Control every task, mention, reply, and Channel alert." icon="bell-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <SheetRow detail="Review the Companies you represent and their access." icon="shield-check" label="Company access" onPress={() => router.push('/company')} />
      </SheetSection>
      <SheetSection title="Appearance">
        <SheetRow icon="theme-light-dark" label="Use device setting" selected={themeOverride === 'system'} onPress={() => setThemeOverride('system')} />
        <SheetRow icon="white-balance-sunny" label="Light" selected={themeOverride === 'light'} onPress={() => setThemeOverride('light')} />
        <SheetRow icon="moon-waning-crescent" label="Dark" selected={themeOverride === 'dark'} onPress={() => setThemeOverride('dark')} />
      </SheetSection>
      <ActionButton disabled={isSigningOut} label="Sign out" loading={isSigningOut} onPress={() => void signOut()} variant="secondary" />
    </ScrollView>
    <OptionsSheet onClose={() => setTimezoneOpen(false)} title="Choose timezone" visible={timezoneOpen}>
      <SheetRow icon="earth" label={timezoneLabel(deviceTimezone())} selected={timezone === deviceTimezone()} onPress={() => { setTimezone(deviceTimezone()); setTimezoneOpen(false); }} />
      <SheetRow icon="earth" label="UTC" selected={timezone === 'UTC'} onPress={() => { setTimezone('UTC'); setTimezoneOpen(false); }} />
    </OptionsSheet>
  </ThemedView>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.four },
  flex: { flex: 1, gap: Spacing.one, minWidth: 0 },
  identityCard: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.four, padding: Spacing.four },
  screen: { flex: 1 },
});
