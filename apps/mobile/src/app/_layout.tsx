import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { authClient } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-client';
import { TrackUserProvider } from '@/contexts/track-user-context';
import { CompanyProvider } from '@/contexts/company-context';
import { ThemeOverrideProvider, useThemeOverride } from '@/contexts/theme-override-context';
import { Colors } from '@/constants/theme';
import { PushNotificationBridge } from '@/lib/push-notifications';
import { OfflineTaskSync } from '@/components/offline-task-sync';
import { LaunchScreen } from '@/components/launch-screen';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync();
}

type ProviderAuthClient = ComponentProps<typeof ConvexBetterAuthProvider>['authClient'];
const providerAuthClient = authClient as unknown as ProviderAuthClient;

const NAV_THEME_LIGHT = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.hairline,
  },
};

const NAV_THEME_DARK = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.hairline,
  },
};

export default function RootLayout() {
  // Do not block the entire application on the icon font. Expo can keep the
  // native splash visible indefinitely when a font request is delayed; the
  // rest of the UI remains usable while the font finishes loading.
  useFonts(MaterialIcons.font);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeOverrideProvider>
          <AppLayout />
        </ThemeOverrideProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppLayout() {
  const { isThemeReady, theme } = useThemeOverride();
  const [continuationDidLayout, setContinuationDidLayout] = useState(false);
  const [showContinuation, setShowContinuation] = useState(true);

  useEffect(() => {
    if (!isThemeReady || !continuationDidLayout) return;

    let active = true;
    const hideNativeSplash = Platform.OS === 'web'
      ? Promise.resolve()
      : SplashScreen.hideAsync();

    void hideNativeSplash.finally(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (active) setShowContinuation(false);
        });
      });
    });
    return () => {
      active = false;
    };
  }, [continuationDidLayout, isThemeReady]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void SystemUI.setBackgroundColorAsync(Colors[theme].background);
    }
  }, [theme]);

  const navTheme = theme === 'dark' ? NAV_THEME_DARK : NAV_THEME_LIGHT;

  return (
    <ConvexBetterAuthProvider client={convexClient} authClient={providerAuthClient}>
      <ThemeProvider value={navTheme}>
        <TrackUserProvider>
          <PushNotificationBridge>
            <CompanyProvider>
              <OfflineTaskSync />
              <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
              <View style={styles.app}>
                <Stack
                  screenOptions={{
                    headerShown: true,
                    headerBackTitle: 'Back',
                    headerShadowVisible: Platform.OS === 'android',
                    headerStyle: {
                      backgroundColor: Colors[theme].background,
                    },
                    headerTintColor: Colors[theme].text,
                    contentStyle: {
                      backgroundColor: Colors[theme].background,
                    },
                  }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="sign-in" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
                  <Stack.Screen name="company" options={{ title: 'Companies' }} />
                </Stack>
                {showContinuation ? (
                  <View pointerEvents="none" style={styles.continuation}>
                    <LaunchScreen onReady={() => setContinuationDidLayout(true)} />
                  </View>
                ) : null}
              </View>
            </CompanyProvider>
          </PushNotificationBridge>
        </TrackUserProvider>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  continuation: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
});
