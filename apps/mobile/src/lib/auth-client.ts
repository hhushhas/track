import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import Constants from 'expo-constants';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { authStoragePrefix } from '@/lib/auth-storage';
import { platformStorage } from '@/lib/platform-storage';

const extraConfig = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
const authBaseURL =
  process.env.EXPO_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??
  extraConfig?.EXPO_PUBLIC_APP_URL ??
  extraConfig?.EXPO_PUBLIC_CONVEX_SITE_URL;

let twoFactorRedirectHandler: ((methods: string[]) => void) | null = null;

export function setTwoFactorRedirectHandler(handler: ((methods: string[]) => void) | null) {
  twoFactorRedirectHandler = handler;
}

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    expoClient({
      scheme: authStoragePrefix,
      storagePrefix: authStoragePrefix,
      storage: platformStorage,
    }) as unknown as BetterAuthClientPlugin,
    convexClient(),
    twoFactorClient({
      onTwoFactorRedirect: ({ twoFactorMethods }) => {
        twoFactorRedirectHandler?.(twoFactorMethods ?? ['totp', 'backup_code']);
      },
    }),
  ],
});
