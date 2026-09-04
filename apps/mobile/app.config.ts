import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const webOutput = process.env.EXPO_WEB_OUTPUT;
  const android = config.android ?? {};
  const ios = config.ios ?? {};
  const extra = config.extra ?? {};
  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  const convexSiteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? process.env.APP_URL;
  const devAuthBypass = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS ?? process.env.VITE_DEV_AUTH_BYPASS;

  return {
    ...config,
    name: config.name ?? 'Q9 Track',
    slug: config.slug ?? 'track',
    scheme: config.scheme ?? 'track',
    icon: config.icon ?? './assets/images/icon.png',
    extra: {
      ...extra,
      ...(convexUrl ? { EXPO_PUBLIC_CONVEX_URL: convexUrl } : {}),
      ...(convexSiteUrl ? { EXPO_PUBLIC_CONVEX_SITE_URL: convexSiteUrl } : {}),
      ...(appUrl ? { EXPO_PUBLIC_APP_URL: appUrl } : {}),
      ...(devAuthBypass ? { EXPO_PUBLIC_DEV_AUTH_BYPASS: devAuthBypass } : {}),
    },
    android: {
      ...android,
      package: android.package ?? 'ai.q9labs.track',
      versionCode: 15,
      softwareKeyboardLayoutMode: 'resize',
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    ios: {
      ...ios,
      bundleIdentifier: ios.bundleIdentifier ?? 'ai.q9labs.track',
    },
    web: {
      ...config.web,
      ...(webOutput === 'single' || webOutput === 'static' || webOutput === 'server'
        ? { output: webOutput }
        : {}),
    },
  };
};
