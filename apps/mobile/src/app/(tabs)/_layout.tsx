import { Tabs } from 'expo-router';

import { PrimaryNavigation } from '@/components/primary-navigation';
import { PrimaryNavigationVisibilityProvider } from '@/contexts/primary-navigation-visibility-context';

export default function PrimaryTabsLayout() {
  return (
    <PrimaryNavigationVisibilityProvider><Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PrimaryNavigation {...props} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Home' }} />
      <Tabs.Screen name="(inbox)" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="(tasks)" options={{ lazy: false, title: 'Tasks' }} />
      <Tabs.Screen name="(team)" options={{ title: 'Team' }} />
      <Tabs.Screen name="(projects)" options={{ href: null, title: 'Projects' }} />
    </Tabs></PrimaryNavigationVisibilityProvider>
  );
}
