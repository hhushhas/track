import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { authClient } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-client';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
