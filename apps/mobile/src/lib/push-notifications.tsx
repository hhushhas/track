import Constants from 'expo-constants';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { useRouter, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { consumePushResponseId, getPushInstallationId } from '@/lib/push-installation';
import { resolvePushAvailability, type PushAvailability } from '@/lib/push-availability';
import { shouldPresentPush } from '@/lib/push-presentation';
import { resolvePushHref } from '@/lib/push-routing';

type NotificationsApi = typeof NotificationsModule;

// Expo Go can still resolve this file, but SDK 53+ intentionally throws when
// remote-notification APIs are loaded there. Keep the module out of the
// evaluation path so Expo Router can load the layout and the rest of the app.
const isExpoGo = Constants.appOwnership === 'expo';
let notificationsApi: NotificationsApi | null = null;

function getNotificationsApi(): NotificationsApi | null {
  if (isExpoGo) return null;
  if (!notificationsApi) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsApi = require('expo-notifications') as NotificationsApi;
  }
  return notificationsApi;
}

export type PushPermissionState = 'not_determined' | 'denied' | 'granted' | 'provisional';
const availability: PushAvailability = resolvePushAvailability({
  expoGo: isExpoGo,
});

type PushContextValue = {
  availability: PushAvailability;
  error: string | null;
  installationId: string | null;
  permissionState: PushPermissionState;
  registered: boolean;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
  openDeviceSettings: () => Promise<void>;
  sendTestNotification: () => Promise<{ attempted: number; queued: number; sent: number; failed: number } | null>;
  syncing: boolean;
};

const PushContext = createContext<PushContextValue | null>(null);

function permissionState(permission: NotificationsModule.NotificationPermissionsStatus): PushPermissionState {
  if (notificationsApi && (permission.ios?.status === notificationsApi.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === notificationsApi.IosAuthorizationStatus.EPHEMERAL)) return 'provisional';
  if (permission.granted) return 'granted';
  if (notificationsApi && permission.status === notificationsApi.PermissionStatus.DENIED) return 'denied';
  return 'not_determined';
}

function pushEnvironment(): 'development' | 'preview' | 'production' {
  const configured = process.env.EXPO_PUBLIC_APP_ENV;
  if (configured === 'development' || configured === 'preview' || configured === 'production') return configured;
  return __DEV__ ? 'development' : 'production';
}

const notifications = getNotificationsApi();
notifications?.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const present = shouldPresentPush(data);
    return {
      shouldPlaySound: present && data?.soundEnabled !== 'false',
      shouldSetBadge: present && notification.request.content.badge !== null,
      shouldShowBanner: present,
      shouldShowList: present,
    };
  },
});

export function usePushNotifications() {
  const context = useContext(PushContext);
  if (!context) throw new Error('usePushNotifications must be used inside PushNotificationBridge');
  return context;
}

export function PushNotificationBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSigningOut, trackUserId } = useTrackUser();
  const { isAuthenticated: convexAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const registerInstallation = useMutation(api.notifications.registerNativeInstallation);
  const reportPermission = useMutation(api.notifications.reportNativePermission);
  const recordOpen = useMutation(api.notifications.recordPushOpen);
  const sendTest = useAction(api.pushNotifications.sendTestNotification);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [localPermission, setLocalPermission] = useState<PushPermissionState>('not_determined');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeUserRef = useRef<Id<'users'> | null>(null);
  activeUserRef.current = isSigningOut || convexAuthLoading || !convexAuthenticated ? null : trackUserId;
  const serverStatus = useQuery(
    api.notifications.getNativeStatus,
    trackUserId && !isSigningOut && !convexAuthLoading && convexAuthenticated
      ? { userId: trackUserId, installationId: installationId ?? undefined }
      : 'skip',
  );

  const sync = useCallback(async (request: boolean) => {
    const push = getNotificationsApi();
    if (availability !== 'available' || !trackUserId || isSigningOut || convexAuthLoading || !convexAuthenticated || Platform.OS === 'web' || !push) return;
    const userId = trackUserId;
    setSyncing(true);
    setError(null);
    try {
      const id = installationId ?? await getPushInstallationId();
      setInstallationId(id);
      if (Platform.OS === 'android') {
        await push.setNotificationChannelAsync('track-default', {
          importance: push.AndroidImportance.HIGH,
          name: 'Track notifications',
          // Omitted sound = system default; a string names a bundled custom file.
          vibrationPattern: [0, 180, 80, 180],
        });
        await push.setNotificationChannelAsync('track-silent', {
          importance: push.AndroidImportance.HIGH,
          name: 'Track notifications (silent)',
          sound: null,
          vibrationPattern: [0, 180, 80, 180],
        });
      }
      const existing = await push.getPermissionsAsync();
      const permission = request && !existing.granted && existing.canAskAgain
        ? await push.requestPermissionsAsync()
        : existing;
      const state = permissionState(permission);
      setLocalPermission(state);
      if (activeUserRef.current !== userId) return;
      const common = {
        userId,
        installationId: id,
        platform: Platform.OS === 'ios' ? 'ios' as const : 'android' as const,
        environment: pushEnvironment(),
        permissionState: state,
        appVersion: Constants.expoConfig?.version,
      };
      if (state !== 'granted' && state !== 'provisional') {
        await reportPermission(common);
        return;
      }
      const token = await push.getDevicePushTokenAsync();
      await registerInstallation({ ...common, token: token.data });
    } catch (failure) {
      if (activeUserRef.current !== userId) return;
      setError(failure instanceof Error ? failure.message : 'notification_sync_failed');
    } finally {
      if (activeUserRef.current === userId) setSyncing(false);
    }
  }, [convexAuthLoading, convexAuthenticated, installationId, isSigningOut, registerInstallation, reportPermission, trackUserId]);

  useEffect(() => {
    const push = getNotificationsApi();
    if (!trackUserId || isSigningOut || convexAuthLoading || !convexAuthenticated || Platform.OS === 'web' || !push) return;
    void sync(false);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync(false);
    });
    const tokenSubscription = push.addPushTokenListener((devicePushToken) => {
      if (!installationId) return;
      void (async () => {
        const permission = await push.getPermissionsAsync();
        if (activeUserRef.current !== trackUserId) return;
        await registerInstallation({
          userId: trackUserId,
          installationId,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          environment: pushEnvironment(),
          permissionState: permissionState(permission),
          appVersion: Constants.expoConfig?.version,
          token: devicePushToken.data,
        });
      })().catch(() => {
        if (activeUserRef.current === trackUserId) setError('push_token_refresh_failed');
      });
    });
    return () => {
      appState.remove();
      tokenSubscription.remove();
    };
  }, [convexAuthLoading, convexAuthenticated, installationId, isSigningOut, registerInstallation, sync, trackUserId]);

  useEffect(() => {
    const push = getNotificationsApi();
    if (!trackUserId || isSigningOut || convexAuthLoading || !convexAuthenticated || Platform.OS === 'web' || !push) return;
    async function open(response: NotificationsModule.NotificationResponse | null) {
      if (!response) return;
      const responseId = response.notification.request.identifier;
      if (!await consumePushResponseId(responseId)) return;
      const data = response.notification.request.content.data;
      const href = resolvePushHref(data);
      if (!href) return;
      const id = installationId ?? await getPushInstallationId();
      if (activeUserRef.current !== trackUserId) return;
      const intentId = data?.intentId;
      if (typeof intentId === 'string') {
        await recordOpen({
          userId: trackUserId!, installationId: id,
          intentId: intentId as Id<'pushDeliveryIntents'>,
        }).catch(() => undefined);
      }
      router.push(href as Href);
    }
    const subscription = push.addNotificationResponseReceivedListener((response) => { void open(response); });
    void push.getLastNotificationResponseAsync().then(open);
    return () => subscription.remove();
  }, [convexAuthLoading, convexAuthenticated, installationId, isSigningOut, recordOpen, router, trackUserId]);

  const value = useMemo<PushContextValue>(() => ({
    availability,
    error,
    installationId,
    permissionState: serverStatus?.permissionState ?? localPermission,
    registered: serverStatus?.registered ?? false,
    requestPermission: () => sync(true),
    refresh: () => sync(false),
    openDeviceSettings: () => Linking.openSettings(),
    sendTestNotification: async () => {
      if (!trackUserId || convexAuthLoading || !convexAuthenticated) return null;
      if (serverStatus?.registered) return await sendTest({ userId: trackUserId });
      if (__DEV__ && (localPermission === 'granted' || localPermission === 'provisional')) {
        const push = getNotificationsApi();
        if (!push) return null;
        await push.scheduleNotificationAsync({
          content: {
            title: 'Track simulator test',
            body: 'Local notification presentation and routing are connected.',
            data: { schemaVersion: '1', eventKind: 'test', url: '/projects' },
          },
          trigger: null,
        });
        return { attempted: 1, queued: 1, sent: 1, failed: 0 };
      }
      return await sendTest({ userId: trackUserId });
    },
    syncing,
  }), [convexAuthLoading, convexAuthenticated, error, installationId, localPermission, sendTest, serverStatus, sync, syncing, trackUserId]);

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}
