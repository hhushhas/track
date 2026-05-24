import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';

import { authClient } from '@/lib/auth-client';
import { useDevAuthBypass } from '@/lib/dev-auth-bypass';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import googleMarkImage from '@/assets/images/google-g.png';
import trackMarkImage from '@/assets/images/track-mark.png';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';

export default function SignInScreen() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const devAuthBypass = useDevAuthBypass();
  const session = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markSource = colorScheme === 'dark' ? trackMarkReversedImage : trackMarkImage;

  async function signIn(provider: 'google' | 'apple') {
    setBusy(true);
    setError(null);
    hapticMedium();
    try {
      const result = provider === 'apple' && Platform.OS === 'ios'
        ? await signInWithNativeApple()
        : await authClient.signIn.social({ provider, callbackURL: '/' });
      const err = (result as { error?: { code?: string; message?: string } | null }).error;
      if (err) {
        throw new Error(err.message ?? err.code ?? 'Sign-in failed');
      }
      await waitForSessionReady(session.refetch);
      router.replace('/');
    } catch (e) {
      hapticLight();
      if (isAppleCancel(e)) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  const showApple = Platform.OS !== 'android';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>

        {/* Brand lockup */}
        <View style={styles.brand}>
          <View style={[styles.markRing, { borderColor: theme.hairline }]}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={markSource}
              style={styles.mark}
            />
          </View>
          <View style={styles.brandText}>
            <ThemedText style={[styles.brandLabel, { color: theme.textSecondary }]} type="code">
              Q9 LABS
            </ThemedText>
            <ThemedText style={styles.brandName}>Track</ThemedText>
            <ThemedText style={[styles.brandTagline, { color: theme.textSecondary }]} type="small">
              Project communication that builds a record
            </ThemedText>
          </View>
        </View>

        {/* Auth panel */}
        <View style={styles.panel}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
              <ThemedText style={{ color: '#b91c1c' }} type="small">{error}</ThemedText>
            </View>
          ) : null}

          {/* Google */}
          <Pressable
            android_ripple={{ color: theme.background }}
            disabled={busy}
            onPress={() => void signIn('google')}
            style={[styles.authButton, styles.authButtonPrimary, { backgroundColor: theme.text, opacity: busy ? 0.7 : 1 }]}>
            <Image accessibilityIgnoresInvertColors source={googleMarkImage} style={styles.authIcon} />
            <ThemedText style={[styles.authLabel, { color: theme.background }]}>
              Continue with Google
            </ThemedText>
          </Pressable>

          {/* Apple */}
          {showApple ? (
            <Pressable
              android_ripple={{ color: theme.hairline }}
              disabled={busy}
              onPress={() => void signIn('apple')}
              style={[styles.authButton, { backgroundColor: theme.backgroundElement, opacity: busy ? 0.7 : 1 }]}>
              <PlatformIcon color={theme.text} name="apple" size={20} />
              <ThemedText style={[styles.authLabel, { color: theme.text }]}>
                Continue with Apple
              </ThemedText>
            </Pressable>
          ) : null}

          {/* Dev bypass */}
          {devAuthBypass.allowed ? (
            <Pressable
              onPress={() => { hapticLight(); devAuthBypass.enable(); router.replace('/'); }}
              style={styles.devBypass}>
              <ThemedText style={{ color: theme.textSecondary }} type="code">Dev bypass</ThemedText>
            </Pressable>
          ) : null}
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          {(['Privacy', 'Terms', 'Support'] as const).map((item, i) => (
            <View key={item} style={styles.footerItem}>
              {i > 0 ? <View style={[styles.footerDot, { backgroundColor: theme.hairline }]} /> : null}
              <Pressable
                hitSlop={8}
                onPress={() => { hapticLight(); void Linking.openURL(
                  item === 'Support' ? 'mailto:q9labs.ai@gmail.com'
                  : `https://track.q9labs.ai/${item.toLowerCase()}`
                ); }}>
                <ThemedText style={{ color: theme.textSecondary }} type="code">{item}</ThemedText>
              </Pressable>
            </View>
          ))}
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

async function signInWithNativeApple() {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sign in with Apple is unavailable on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  return await authClient.signIn.social({
    provider: 'apple',
    idToken: {
      token: credential.identityToken,
      user: getAppleUserPayload(credential),
    },
    callbackURL: '/',
  });
}

async function waitForSessionReady(
  refetch: ReturnType<typeof authClient.useSession>['refetch'],
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await refetch({ query: { disableCookieCache: true } });

    const snapshot = authClient.$store.atoms.session?.get() as { data?: unknown } | undefined;
    if (snapshot?.data) return;

    await sleep(250);
  }

  throw new Error('Sign-in completed, but the session was not ready. Please try again.');
}

function getAppleUserPayload(credential: AppleAuthentication.AppleAuthenticationCredential) {
  const firstName = credential.fullName?.givenName?.trim();
  const lastName = credential.fullName?.familyName?.trim();
  const email = credential.email?.trim();

  if (!firstName && !lastName && !email) return undefined;

  return {
    name: firstName || lastName ? { firstName, lastName } : undefined,
    email,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAppleCancel(error: unknown) {
  return error instanceof Error
    && (error as Error & { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

const styles = StyleSheet.create({
  authButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
  },
  authButtonPrimary: {
    // slightly elevated appearance via shadow on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  authIcon: { height: 20, width: 20 },
  authLabel: { fontSize: 15, fontWeight: '600', letterSpacing: 0 },
  brand: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.four,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  brandLabel: { letterSpacing: 1 },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  brandTagline: {
    textAlign: 'center',
  },
  brandText: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  devBypass: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  footerDot: {
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  mark: {
    height: 64,
    width: 64,
  },
  markRing: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  panel: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  safe: { flex: 1 },
  screen: { flex: 1 },
});
