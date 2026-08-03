import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { hasStoredAuthSession } from '@/lib/auth-storage';
import { useDevAuthBypass } from '@/lib/dev-auth-bypass';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';

export default function Index() {
  const theme = useTheme();
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
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  // Only a settled, empty session sends anyone to sign-in.
  if (!hasAccess) return <Redirect href="/sign-in" />;

  if (isAuthReady && trackUserId) return <Redirect href="/projects" />;

  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
