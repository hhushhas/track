import { ConvexReactClient } from 'convex/react';
import { shouldAllowDevAuthBypass } from '@track/shared';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

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
