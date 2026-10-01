import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { hasStoredAuthSession } from '@/lib/auth-storage';
import { useDevAuthBypass } from '@/lib/dev-auth-bypass';
import { useTrackUser } from '@/contexts/track-user-context';
import { AnimatedTrackLogo } from '@/components/animated-track-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function Index() {
  const session = authClient.useSession();
  const devAuthBypass = useDevAuthBypass();
  const { trackUserId, isAuthReady } = useTrackUser();
  const sessionData = session.data;
  const sessionIsPending = session.isPending;
  const refetchSession = session.refetch;

  const hasAccess = Boolean(sessionData || devAuthBypass.enabled);
  /**
   * A device that kept credentials is treated as signed in until the session
   * says otherwise. The flag is seeded during the first render, because a
   * redirect decided in render lands before any effect can hold it back — that
   * is what threw a returning user onto the sign-in screen for a frame.
   */
  const [restoreSettled, setRestoreSettled] = useState(() => !hasStoredAuthSession());

  useEffect(() => {
    if (restoreSettled) return;
    if (sessionData || devAuthBypass.enabled) {
      setRestoreSettled(true);
      return;
    }
    // The client is still asking; its own pending flag holds the splash.
    if (sessionIsPending) return;

    // The stored credentials outlived the cached session, so ask the server
    // once with the cookie cache off before calling the user signed out.
    let active = true;
    const settle = () => { if (active) setRestoreSettled(true); };
    void refetchSession({ query: { disableCookieCache: true } }).then(settle, settle);
    const timeout = setTimeout(settle, 1500);
    return () => { active = false; clearTimeout(timeout); };
  }, [devAuthBypass.enabled, refetchSession, restoreSettled, sessionData, sessionIsPending]);

  if ((sessionIsPending || !restoreSettled) && !devAuthBypass.enabled) {
    return <StartupLoadingScreen />;
  }

  // Only a settled, empty session sends anyone to sign-in.
  if (!hasAccess) return <Redirect href="/sign-in" />;

  if (isAuthReady && trackUserId) return <Redirect href={{ pathname: '/conversations', params: { startup: '1' } }} />;

  return <StartupLoadingScreen />;
}

function StartupLoadingScreen() {
  return (
    <ThemedView accessibilityLabel="Getting Track ready" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.startupScreen}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AnimatedTrackLogo showName size={96} />
      </View>
      <ThemedText themeColor="textSecondary" type="small">
        Getting Track ready…
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  startupScreen: { alignItems: 'center', flex: 1, gap: Spacing.five, justifyContent: 'center', padding: Spacing.five },
});
