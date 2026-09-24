import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Colors, Typography } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTheme } from '@/hooks/use-theme';

/** Shared quiet canvas for screen headers, matching the Home dashboard. */
export function TrackHeaderBackground() {
  const theme = useTheme();
  return <View style={[StyleSheet.absoluteFill, styles.header, {
    backgroundColor: theme.homeBackground,
  }]} />;
}

export function PrimaryStack({ initialRouteName }: { initialRouteName: string }) {
  const { theme } = useThemeOverride();

  return (
    <Stack
      initialRouteName={initialRouteName}
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: true,
        headerLargeTitle: false,
        headerTransparent: false,
        headerBackButtonDisplayMode: 'minimal',
        headerBackground: TrackHeaderBackground,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: 'transparent' },
        headerTitleAlign: 'left',
        headerTitleStyle: Typography.display,
        headerTintColor: Colors[theme].text,
        contentStyle: { backgroundColor: Colors[theme].homeBackground },
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 0,
  },
});
