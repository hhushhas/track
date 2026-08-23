import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const webOutput = process.env.EXPO_WEB_OUTPUT;

  return {
    ...config,
    name: config.name ?? 'Q9 Track',
    slug: config.slug ?? 'track',
    android: {
      ...config.android,
      softwareKeyboardLayoutMode: 'resize',
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    web: {
      ...config.web,
      ...(webOutput === 'single' || webOutput === 'static' || webOutput === 'server'
        ? { output: webOutput }
        : {}),
    },
  };
};
