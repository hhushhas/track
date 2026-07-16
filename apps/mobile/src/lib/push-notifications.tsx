import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { resolvePushHref } from '@/lib/push-routing';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushNotificationBridge() {
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const { membershipId } = useLocalSearchParams<{ membershipId?: string }>();
  const registerToken = useMutation(api.notifications.registerNativeToken);

  useEffect(() => {
    if (!trackUserId || Platform.OS === 'web') return;
    let canceled = false;
    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      const result = permission.granted ? permission : await Notifications.requestPermissionsAsync();
      if (!result.granted || canceled) return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          importance: Notifications.AndroidImportance.HIGH,
          name: 'Track notifications',
        });
      }
      const projectId = Constants.easConfig?.projectId ??
        (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (canceled) return;
      await registerToken({
        userId: trackUserId,
        projectMemberId: membershipId as Id<'projectMembers'> | undefined,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        token: token.data,
      });
    })().catch(() => undefined);
    return () => { canceled = true; };
  }, [membershipId, registerToken, trackUserId]);

  useEffect(() => {
    function open(response: Notifications.NotificationResponse | null) {
      const href = resolvePushHref(response?.notification.request.content.data);
      if (href) router.push(href as Href);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}
