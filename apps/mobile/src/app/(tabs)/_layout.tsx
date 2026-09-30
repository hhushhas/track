import { Tabs } from 'expo-router';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { PrimaryNavigationVisibilityProvider } from '@/contexts/primary-navigation-visibility-context';

export default function PrimaryTabsLayout() {
  return (
    <PrimaryNavigationVisibilityProvider><Tabs
      backBehavior="history"
      detachInactiveScreens={false}
      screenOptions={{
        animation: 'none',
        headerShown: false,
      }}
      tabBar={(props) => <PrimaryNavigation {...props} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Chats' }} />
      <Tabs.Screen name="(tasks)" options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="(inbox)" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="(profile)" options={{ title: 'Profile' }} />
      <Tabs.Screen name="(projects)" options={{ href: null, title: 'Projects' }} />
    </Tabs></PrimaryNavigationVisibilityProvider>
  );
}
