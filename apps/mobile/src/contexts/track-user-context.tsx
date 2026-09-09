import { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ActionButton } from '@/components/action-button';
import { ColoredAvatar } from '@/components/colored-avatar';
import { authClient, setTwoFactorRedirectHandler } from '@/lib/auth-client';
import { clearStoredAuthSession } from '@/lib/auth-storage';
import { useDevAuthBypass } from '@/lib/dev-auth-bypass';
import { getStoredPushInstallationId } from '@/lib/push-installation';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { ThemedText } from '@/components/themed-text';
import { TimezonePicker } from '@/components/timezone-picker';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { hapticDestructive } from '@/lib/haptics';
import { deviceTimezone, findTimezone } from '@/lib/timezones';
import { withOperationTimeout } from '@/lib/promise-timeout';

type TrackUserContextValue = {
  trackUserId: Id<'users'> | null;
  isAuthReady: boolean;
  isSigningOut: boolean;
  signOut: () => Promise<void>;
  openProfileSheet: () => void;
  devAuthBypass: ReturnType<typeof useDevAuthBypass>;
};

const TrackUserContext = createContext<TrackUserContextValue | null>(null);

/** Shows the saved IANA id as a place; unknown ids fall back to the raw id. */
function timezoneLabel(id: string) {
  const zone = findTimezone(id);
  return zone ? `${zone.flag} ${zone.city} · ${zone.countryName}` : id;
}

export function useTrackUser() {
  const ctx = useContext(TrackUserContext);
  if (!ctx) throw new Error('useTrackUser must be used inside TrackUserProvider');
  return ctx;
}

export function TrackUserProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { themeOverride, setThemeOverride } = useThemeOverride();
  const router = useRouter();
  const devAuthBypass = useDevAuthBypass();
  const session = authClient.useSession();

  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser);
  const syncDevUser = useMutation(api.auth.syncDevUser);
  const acceptInvites = useMutation(api.invitations.acceptPendingForCurrentUser);
  const updateProfile = useMutation(api.auth.updateProfile);
  const detachPushInstallation = useMutation(api.notifications.detachNativeInstallation);
  const requestAccountDeletion = useMutation(api.auth.requestAccountDeletion);
  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sheet, setSheet] = useState<'profile' | 'two-factor' | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<'account' | 'invites' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    displayName: '',
    profileDesignation: '',
    timezone: deviceTimezone(),
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'backup_code'>('totp');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [accountAction, setAccountAction] = useState<'delete' | 'sign-out' | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const trackUser = useQuery(api.auth.getCurrentUser);
  const profileStatus = useQuery(
    api.auth.getProfileStatus,
    trackUserId ? { userId: trackUserId } : 'skip',
  );

  const hasAccess = Boolean(session.data || devAuthBypass.enabled);

  // Sync user on session arrival
  useEffect(() => {
    if (!hasAccess || trackUserId) return;
    if (session.isPending && !devAuthBypass.enabled) return;
    const syncUser = devAuthBypass.enabled && !session.data ? syncDevUser : ensureCurrentUser;
    setBootstrapError(null);
    void syncUser()
      .then(async (userId) => {
        if (!userId) return;
        setTrackUserId(userId);
        setIsAuthReady(true);
        try {
          await acceptInvites({ userId });
        } catch {
          setBootstrapError('invites');
        }
      })
      .catch(() => setBootstrapError('account'));
  }, [acceptInvites, devAuthBypass.enabled, ensureCurrentUser, hasAccess, session.data, session.isPending, syncDevUser, trackUserId]);

  // Keep trackUserId in sync with the convex getCurrentUser query
  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) {
      setTrackUserId(trackUser._id);
      setIsAuthReady(true);
    }
  }, [trackUser?._id, trackUserId]);

  // Show profile sheet if profile is incomplete
  useEffect(() => {
    if (!profileStatus?.user) return;
    setProfileDraft({
      displayName: profileStatus.user.displayName ?? '',
      profileDesignation: profileStatus.user.profileDesignation ?? '',
      timezone: profileStatus.user.timezone ?? deviceTimezone(),
    });
    if (!profileStatus.complete) setSheet('profile');
  }, [profileStatus?.complete, profileStatus?.user]);

  // 2FA redirect
  useEffect(() => {
    setTwoFactorRedirectHandler(() => {
      setActionError(null);
      setSheet('two-factor');
    });
    return () => setTwoFactorRedirectHandler(null);
  }, []);

  // Redirect to sign-in when session is lost
  useEffect(() => {
    if (session.isPending) return;
    if (!hasAccess && isAuthReady) {
      setTrackUserId(null);
      setIsAuthReady(false);
      router.replace('/sign-in');
    }
  }, [hasAccess, isAuthReady, router, session.isPending]);

  async function withBusy(key: string, fn: () => Promise<unknown>) {
    setBusyAction(key);
    setActionError(null);
    try {
      await fn();
    } catch {
      setActionError(key === 'profile'
        ? 'We could not save your profile. Check your connection and try again.'
        : 'We could not verify that code. Check it and try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function retryBootstrap() {
    if (bootstrapError === 'account') {
      setBusyAction('account');
      setBootstrapError(null);
      const syncUser = devAuthBypass.enabled && !session.data ? syncDevUser : ensureCurrentUser;
      try {
        const userId = await syncUser();
        if (!userId) throw new Error('account_sync_failed');
        setTrackUserId(userId);
        setIsAuthReady(true);
        try {
          await acceptInvites({ userId });
        } catch {
          setBootstrapError('invites');
        }
      } catch {
        setBootstrapError('account');
      } finally {
        setBusyAction(null);
      }
      return;
    }
    if (!trackUserId) return;
    setBusyAction('invites');
    try {
      await acceptInvites({ userId: trackUserId });
      setBootstrapError(null);
    } catch {
      setBootstrapError('invites');
    } finally {
      setBusyAction(null);
    }
  }

  async function signOut() {
    setBusyAction('sign-out');
    setSignOutError(null);
    if (trackUserId) {
      try {
        const installationId = await getStoredPushInstallationId();
        if (installationId) {
          await withOperationTimeout(
            detachPushInstallation({ installationId }),
            10_000,
            'push_detach',
          );
        }
      } catch {
        setSignOutError('Could not safely disconnect this device from notifications. Check your connection and try signing out again.');
        setBusyAction(null);
        return;
      }
    }
    try {
      await withOperationTimeout(authClient.signOut(), 10_000, 'sign_out');
    } catch {
      const sessionAtom = authClient.$store.atoms.session;
      const currentSession = sessionAtom?.get?.();
      if (sessionAtom && currentSession) {
        sessionAtom.set({
          ...currentSession,
          data: null,
          error: null,
          isPending: false,
          isRefetching: false,
        });
      }
    } finally {
      devAuthBypass.disable();
      clearStoredAuthSession();
      setSheet(null);
      setTrackUserId(null);
      setIsAuthReady(false);
      setBusyAction(null);
      router.replace('/sign-in');
    }
  }

  async function submitProfile() {
    if (!trackUserId) return;
    await withBusy('profile', async () => {
      await updateProfile({
        userId: trackUserId,
        displayName: profileDraft.displayName,
        profileDesignation: profileDraft.profileDesignation,
        timezone: profileDraft.timezone,
        profileBannerStyle: 'silk',
      });
      setSheet(null);
    });
  }

  async function deleteAccount() {
    if (!trackUserId || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await requestAccountDeletion({ userId: trackUserId });
      setAccountAction(null);
      await signOut();
    } catch (error) {
      Alert.alert(
        'Deletion request not completed',
        error instanceof Error && error.message.includes('company_ownership_transfer_required')
          ? 'Transfer sole Company ownership on the web, then try again.'
          : 'Check your connection and try again in a moment.',
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function submitTwoFactor() {
    await withBusy('two-factor', async () => {
      const result =
        twoFactorMethod === 'backup_code'
          ? await authClient.twoFactor.verifyBackupCode({
              code: twoFactorCode,
              disableSession: false,
            })
          : await authClient.twoFactor.verifyTotp({ code: twoFactorCode });
      if (result.error) {
        throw new Error(result.error.message ?? 'Two-factor verification failed.');
      }
      await session.refetch({ query: { disableCookieCache: true } });
      setTwoFactorCode('');
      setSheet(null);
      router.replace('/');
    });
  }

  const value: TrackUserContextValue = {
    trackUserId,
    isAuthReady,
    isSigningOut: busyAction === 'sign-out',
    signOut,
    openProfileSheet: () => {
      setActionError(null);
      setSheet('profile');
    },
    devAuthBypass,
  };

  return (
    <TrackUserContext.Provider value={value}>
      {children}

      {bootstrapError ? (
        <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">
            {bootstrapError === 'account'
              ? 'We could not finish setting up your account.'
              : 'Your account is ready, but pending invitations could not be accepted.'}
          </ThemedText>
          <ThemedText type="small">Check your connection, then try again.</ThemedText>
          <ActionButton
            disabled={busyAction !== null}
            label="Try again"
            loading={busyAction === bootstrapError}
            onPress={() => void retryBootstrap()}
            style={styles.retryButton}
            variant="secondary"
          />
        </View>
      ) : null}

      {signOutError ? (
        <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Sign out was stopped to keep notifications private.</ThemedText>
          <ThemedText type="small">{signOutError}</ThemedText>
          <ActionButton
            disabled={busyAction !== null}
            label="Try again"
            loading={busyAction === 'sign-out'}
            onPress={() => void signOut()}
            style={styles.retryButton}
            variant="secondary"
          />
        </View>
      ) : null}

      {/*
        Android will not reliably present a second modal over a first, so the
        profile sheet stands down while the timezone picker is up. The draft
        lives in state, so the sheet comes back exactly as it was left.
      */}
      <OptionsSheet
        onClose={() => profileStatus?.complete ? setSheet(null) : undefined}
        title="Account"
        visible={sheet === 'profile' && !timezoneOpen}>
        {profileStatus?.user ? (
          <View style={styles.profileSummary}>
            <ColoredAvatar label={profileStatus.user.displayName || profileStatus.user.email} seed={profileStatus.user._id} size={48} />
            <View style={styles.profileIdentity}>
              <ThemedText numberOfLines={1} type="title">{profileStatus.user.displayName || 'Track member'}</ThemedText>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{profileStatus.user.email}</ThemedText>
              <ThemedText themeColor="textSecondary" type="caption">
                {profileStatus.user.twoFactorEnabled ? 'Two-factor authentication enabled' : 'Password-protected account'}
              </ThemedText>
            </View>
          </View>
        ) : null}
        <SheetSection>
          <View style={styles.profileInputs}>
            <SheetInput
              label="Name"
              maxLength={100}
              onChangeText={(displayName) => setProfileDraft((d) => ({ ...d, displayName }))}
              value={profileDraft.displayName}
            />
            <SheetInput
              label="Designation"
              maxLength={100}
              onChangeText={(profileDesignation) => setProfileDraft((d) => ({ ...d, profileDesignation }))}
              value={profileDraft.profileDesignation}
            />
            <SheetFieldButton
              icon="earth"
              label="Timezone"
              onPress={() => setTimezoneOpen(true)}
              placeholder="Choose a timezone"
              value={timezoneLabel(profileDraft.timezone)}
            />
          </View>
        </SheetSection>
        {actionError ? <ThemedText accessibilityRole="alert" style={styles.errorText} type="small">{actionError}</ThemedText> : null}
        <ActionButton
          disabled={busyAction === 'profile' || !profileDraft.displayName.trim()}
          label="Save profile"
          loading={busyAction === 'profile'}
          onPress={() => void submitProfile()}
        />
        {profileStatus?.complete ? (
          <>
            <SheetSection title="Appearance">
              <SheetRow icon="theme-light-dark" label="Auto" selected={themeOverride === 'system'} onPress={() => setThemeOverride('system')} />
              <SheetRow icon="white-balance-sunny" label="Light" selected={themeOverride === 'light'} onPress={() => setThemeOverride('light')} />
              <SheetRow icon="moon-waning-crescent" label="Dark" selected={themeOverride === 'dark'} onPress={() => setThemeOverride('dark')} />
            </SheetSection>
            <SheetSection title="Preferences">
              <SheetRow icon="bell-outline" label="Notifications" onPress={() => { setSheet(null); router.push('/notifications'); }} />
              <SheetRow icon="shield-lock-outline" label="Privacy policy" onPress={() => void Linking.openURL('https://track.q9labs.ai/privacy')} />
              <SheetRow icon="file-document-outline" label="Terms of service" onPress={() => void Linking.openURL('https://track.q9labs.ai/terms')} />
              <SheetRow icon="email-outline" label="Support" onPress={() => void Linking.openURL('mailto:q9labs.ai@gmail.com')} />
            </SheetSection>
            <SheetSection>
              <SheetRow icon="logout" label="Sign out" onPress={() => { setSheet(null); setAccountAction('sign-out'); }} />
              <SheetRow destructive icon="trash-can-outline" label={deletingAccount ? 'Deleting account…' : 'Delete account'} onPress={() => {
                hapticDestructive();
                setSheet(null);
                setAccountAction('delete');
              }} />
            </SheetSection>
          </>
        ) : null}
      </OptionsSheet>

      <OptionsSheet onClose={() => setAccountAction(null)} title={accountAction === 'delete' ? 'Delete account' : 'Sign out'} visible={accountAction !== null}>
        <View style={styles.accountConfirmation}>
          <ThemedText type="subtitle">{accountAction === 'delete' ? 'Request account deletion?' : 'Sign out of Track?'}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {accountAction === 'delete'
              ? 'Track will schedule removal of your profile and disable notifications. Shared Project and Channel content stays available to collaborators.'
              : 'You will need to sign in again to read messages and update tasks on this device.'}
          </ThemedText>
          <View style={styles.accountActions}>
            <ActionButton label="Cancel" onPress={() => setAccountAction(null)} variant="secondary" />
            {accountAction === 'delete'
              ? <ActionButton label="Request deletion" loading={deletingAccount} onPress={() => void deleteAccount()} variant="destructive" />
              : <ActionButton label="Sign out" loading={busyAction === 'sign-out'} onPress={() => {
                  setAccountAction(null);
                  void signOut();
                }} />}
          </View>
        </View>
      </OptionsSheet>

      <TimezonePicker
        onClose={() => setTimezoneOpen(false)}
        onSelect={(timezone) => {
          setProfileDraft((d) => ({ ...d, timezone }));
          setTimezoneOpen(false);
        }}
        value={profileDraft.timezone}
        visible={timezoneOpen}
      />

      <OptionsSheet onClose={() => setSheet(null)} title="Two-factor authentication" visible={sheet === 'two-factor'}>
        <SheetSection>
          <View style={styles.segmented}>
            {(['totp', 'backup_code'] as const).map((method) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: twoFactorMethod === method }}
                key={method}
                onPress={() => setTwoFactorMethod(method)}
                style={[
                  styles.segment,
                  { backgroundColor: twoFactorMethod === method ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <ThemedText type="small">{method === 'totp' ? 'Authenticator' : 'Backup code'}</ThemedText>
              </Pressable>
            ))}
          </View>
          <SheetInput label="Code" maxLength={64} onChangeText={setTwoFactorCode} value={twoFactorCode} />
        </SheetSection>
        {actionError ? <ThemedText accessibilityRole="alert" style={styles.errorText} type="small">{actionError}</ThemedText> : null}
        <ActionButton
          disabled={busyAction === 'two-factor' || !twoFactorCode.trim()}
          label="Verify"
          loading={busyAction === 'two-factor'}
          onPress={() => void submitTwoFactor()}
        />
      </OptionsSheet>
    </TrackUserContext.Provider>
  );
}

const styles = StyleSheet.create({
  accountActions: { gap: Spacing.two },
  accountConfirmation: { gap: Spacing.three },
  errorBanner: {
    borderRadius: Radius.large,
    bottom: Spacing.four,
    gap: Spacing.two,
    left: Spacing.four,
    padding: Spacing.three,
    position: 'absolute',
    right: Spacing.four,
  },
  errorText: {
    paddingHorizontal: Spacing.three,
  },
  profileInputs: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  profileIdentity: { flex: 1, gap: 2, minWidth: 0 },
  profileSummary: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.medium,
    borderWidth: 1,
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  segment: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flex: 1,
    paddingVertical: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
