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
  const [restoreGrace, setRestoreGrace] = useState(false);
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  const sessionData = session.data;
  const sessionIsPending = session.isPending;
  const refetchSession = session.refetch;

  const hasAccess = Boolean(sessionData || devAuthBypass.enabled);
  const hasStoredSession = hasStoredAuthSession();

  useEffect(() => {
    if (sessionData || sessionIsPending || !hasStoredSession || devAuthBypass.enabled) {
      setRestoreGrace(false);
      setRestoreAttempted(false);
      return;
    }
    if (restoreAttempted) return;

    setRestoreAttempted(true);
    setRestoreGrace(true);
    void refetchSession({ query: { disableCookieCache: true } });

    const timeout = setTimeout(() => setRestoreGrace(false), 1500);
    return () => clearTimeout(timeout);
  }, [devAuthBypass.enabled, hasStoredSession, refetchSession, restoreAttempted, sessionData, sessionIsPending]);

  if ((sessionIsPending || restoreGrace) && !devAuthBypass.enabled) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

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
