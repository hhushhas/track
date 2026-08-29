import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const webOutput = process.env.EXPO_WEB_OUTPUT;
  const android = config.android ?? {};
  const ios = config.ios ?? {};

  return {
    ...config,
    name: config.name ?? 'Q9 Track',
    slug: config.slug ?? 'track',
    android: {
      ...android,
      package: android.package ?? 'ai.q9labs.track',
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
