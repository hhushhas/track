import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';

export function PrimaryStack({ initialRouteName }: { initialRouteName: string }) {
  const { theme } = useThemeOverride();

  return (
    <Stack
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: true,
        headerLargeTitle: false,
        headerTransparent: false,
        headerBackTitle: 'Back',
        headerShadowVisible: Platform.OS === 'android',
        headerStyle: { backgroundColor: Colors[theme].background },
        headerTintColor: Colors[theme].text,
        contentStyle: { backgroundColor: Colors[theme].background },
      }}
    />
  );
}
