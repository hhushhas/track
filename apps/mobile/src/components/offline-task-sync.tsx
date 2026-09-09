import { useMutation } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { clearOfflineTaskError, markOfflineTaskFailed, readOfflineTasks, removeOfflineTask, type OfflineTaskItem } from '@/lib/offline-task-queue';
import { ThemedText } from './themed-text';

/** Replays only reviewed tasks, after the server confirms the device is online. */
export function OfflineTaskSync() {
  const theme = useTheme();
  const network = useNetworkState();
  const { trackUserId } = useTrackUser();
  const createTask = useMutation(api.tasks.create);
  const [pending, setPending] = useState<OfflineTaskItem[]>([]);
  const [retryToken, setRetryToken] = useState(0);
  const flushing = useRef(false);

  useEffect(() => {
    if (!trackUserId) {
      setPending([]);
      return;
    }
    let cancelled = false;
    void readOfflineTasks(trackUserId).then((items) => {
      if (!cancelled) setPending(items);
    });
    return () => { cancelled = true; };
  }, [trackUserId]);

  useEffect(() => {
    if (!trackUserId || network.isConnected !== true || flushing.current) return;
    flushing.current = true;
    void readOfflineTasks(trackUserId).then(async (items) => {
      for (const item of items) {
        try {
          const { queuedAt: _queuedAt, lastError: _lastError, ...taskInput } = item;
          await createTask(taskInput);
          await removeOfflineTask(trackUserId, item.idempotencyKey);
        } catch {
          await markOfflineTaskFailed(trackUserId, item.idempotencyKey, 'sync_failed');
          break;
        }
      }
      setPending(await readOfflineTasks(trackUserId));
    }).finally(() => { flushing.current = false; });
  }, [createTask, network.isConnected, retryToken, trackUserId]);

  if (!pending.length) return null;
  const hasFailure = pending.some((item) => item.lastError);
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
      <ThemedText type="smallBold">{hasFailure ? 'Some saved tasks need attention.' : `${pending.length} task${pending.length === 1 ? '' : 's'} waiting to sync.`}</ThemedText>
      <ThemedText themeColor="textSecondary" type="caption">{hasFailure ? 'A sync attempt failed. Retry when your connection or access is ready.' : 'They will be created after Track confirms the connection.'}</ThemedText>
      {hasFailure ? <Pressable accessibilityRole="button" onPress={() => {
        if (!trackUserId) return;
        void Promise.all(pending.filter((item) => item.lastError).map((item) => clearOfflineTaskError(trackUserId, item.idempotencyKey)))
          .then(() => setRetryToken((value) => value + 1));
      }} style={styles.retry}>
        <ThemedText themeColor="accentStrong" type="smallBold">Retry now</ThemedText>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 2, paddingHorizontal: 16, paddingVertical: 10 },
  retry: { alignSelf: 'flex-start', marginTop: Spacing.one, minHeight: TouchTarget, justifyContent: 'center' },
});
