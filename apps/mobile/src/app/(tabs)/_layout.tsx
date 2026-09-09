import { Tabs } from 'expo-router';

import { PrimaryNavigation } from '@/components/primary-navigation';

export default function PrimaryTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PrimaryNavigation {...props} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Home' }} />
      <Tabs.Screen name="(projects)" options={{ title: 'Projects' }} />
      <Tabs.Screen name="(tasks)" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="(search)" options={{ title: 'Evidence' }} />
    </Tabs>
  );
}
