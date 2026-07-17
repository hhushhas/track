import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { authClient } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-client';
import { TrackUserProvider } from '@/contexts/track-user-context';
import { CompanyProvider } from '@/contexts/company-context';
import { ThemeOverrideProvider } from '@/contexts/theme-override-context';
import { Colors } from '@/constants/theme';
import { PushNotificationBridge } from '@/lib/push-notifications';

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
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(MaterialCommunityIcons.font);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void SystemUI.setBackgroundColorAsync(colorScheme === 'dark' ? Colors.dark.background : Colors.light.background);
    }
  }, [colorScheme]);

  if (!fontsLoaded) return null;

  const navTheme = colorScheme === 'dark' ? NAV_THEME_DARK : NAV_THEME_LIGHT;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeOverrideProvider>
        <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
          <ThemeProvider value={navTheme}>
            <TrackUserProvider>
              <PushNotificationBridge>
                <CompanyProvider>
                <StatusBar style="auto" />
                <Stack
                screenOptions={{
                  headerShown: true,
                  headerBackTitle: 'Back',
                  headerShadowVisible: Platform.OS === 'android',
                  headerStyle: {
                    backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                  },
                  headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                  contentStyle: {
                    backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                  },
                }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="sign-in" options={{ headerShown: false }} />
                <Stack.Screen name="projects" options={{ title: 'Projects' }} />
                <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
                <Stack.Screen name="company" options={{ title: 'Companies' }} />
                <Stack.Screen name="groups" options={{ title: 'Channels' }} />
                <Stack.Screen name="conversation" options={{ title: 'Conversation' }} />
                <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
                <Stack.Screen name="task" options={{ title: 'Task' }} />
                <Stack.Screen name="threads" options={{ title: 'Threads' }} />
                <Stack.Screen name="thread" options={{ title: 'Thread' }} />
                </Stack>
                </CompanyProvider>
              </PushNotificationBridge>
            </TrackUserProvider>
          </ThemeProvider>
        </ConvexBetterAuthProvider>
      </ThemeOverrideProvider>
    </GestureHandlerRootView>
  );
}
