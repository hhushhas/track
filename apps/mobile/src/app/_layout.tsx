import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import React from 'react';
import { useColorScheme } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-client';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(MaterialCommunityIcons.font);

  if (!fontsLoaded) return null;

  return (
    <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
