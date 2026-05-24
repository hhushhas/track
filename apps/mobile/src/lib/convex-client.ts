import { ConvexReactClient } from 'convex/react';
import { shouldAllowDevAuthBypass } from '@track/shared';
import Constants from 'expo-constants';

const extraConfig = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? extraConfig?.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('EXPO_PUBLIC_CONVEX_URL is required');
}

export const convexClient = new ConvexReactClient(convexUrl, {
  expectAuth: !shouldAllowDevAuthBypass({
    flag: process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS,
    isDev: process.env.NODE_ENV !== 'production',
  }),
  unsavedChangesWarning: false,
});
