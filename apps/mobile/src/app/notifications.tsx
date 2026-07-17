import { useMutation, useQuery } from 'convex/react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import { SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { usePushNotifications } from '@/lib/push-notifications';

type ConversationMode = 'all' | 'mentions' | 'none';
type TaskMode = 'important' | 'all' | 'muted';
type PreviewMode = 'context' | 'hidden';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const { trackUserId } = useTrackUser();
  const push = usePushNotifications();
  const settings = useQuery(api.notifications.getSettings, trackUserId ? { userId: trackUserId } : 'skip');
  const diagnostics = useQuery(api.pushDelivery.getDiagnostics, trackUserId ? { userId: trackUserId } : 'skip');
  const setPreferences = useMutation(api.notifications.setMobilePreferences);
  const global = settings?.global ?? {
    globalMode: 'all' as const,
    taskMode: 'all' as const,
    previewMode: 'context' as const,
    soundEnabled: true,
    badgesEnabled: true,
  };

  function update(changes: Partial<{
    conversationMode: ConversationMode;
    taskMode: TaskMode;
    previewMode: PreviewMode;
    soundEnabled: boolean;
    badgesEnabled: boolean;
  }>) {
    if (!trackUserId) return;
    void setPreferences({
      userId: trackUserId,
      ...changes,
    }).catch(() => Alert.alert('Settings not saved', 'Check your connection and try again.'));
  }

  async function sendTest() {
    const result = await push.sendTestNotification();
    if (!result) return;
    Alert.alert(
      result.queued > 0 ? 'Test queued' : 'Test not queued',
      `${result.queued} queued · ${result.failed} failed across ${result.attempted} target${result.attempted === 1 ? '' : 's'}.`,
    );
  }

  const permissionTitle = push.permissionState === 'granted' || push.permissionState === 'provisional'
    ? push.registered ? 'Notifications are connected' : 'Finishing notification setup'
    : push.permissionState === 'denied' ? 'Notifications are disabled' : 'Stay current when Track is closed';
  const permissionBody = push.permissionState === 'denied'
    ? `Enable Track in ${Platform.OS === 'ios' ? 'iOS' : 'Android'} Settings to receive Project activity.`
    : push.permissionState === 'granted' || push.permissionState === 'provisional'
      ? 'Track will notify this device for eligible conversation and task activity.'
      : 'Get timely mentions, replies, Channel activity, and task changes without including message or task content in the push payload.';

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.permissionCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
            <PlatformIcon color={theme.accent} name={push.permissionState === 'denied' ? 'bell-off-outline' : 'bell-outline'} size={28} />
          </View>
          <ThemedText type="subtitle">{permissionTitle}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>{permissionBody}</ThemedText>
          {push.error ? <ThemedText style={{ color: '#b91c1c' }} type="small">{push.error.replaceAll('_', ' ')}</ThemedText> : null}
          {push.permissionState === 'denied' ? (
            <PrimaryButton disabled={push.syncing} label="Open device settings" onPress={() => void push.openDeviceSettings()} />
          ) : push.permissionState === 'not_determined' ? (
            <PrimaryButton disabled={push.syncing} label={push.syncing ? 'Checking…' : 'Enable notifications'} onPress={() => void push.requestPermission()} />
          ) : !push.registered ? (
            <PrimaryButton disabled={push.syncing} label={push.syncing ? 'Connecting…' : 'Try again'} onPress={() => void push.refresh()} />
          ) : null}
        </View>

        <SheetSection title="Conversation default">
          {(['all', 'mentions', 'none'] as const).map((mode) => (
            <SheetRow key={mode} label={mode === 'all' ? 'All messages' : mode === 'mentions' ? 'Mentions and replies' : 'Off'} selected={global.globalMode === mode} onPress={() => update({ conversationMode: mode })} />
          ))}
        </SheetSection>

        <SheetSection title="Task default">
          {(['important', 'all', 'muted'] as const).map((mode) => (
            <SheetRow key={mode} label={mode === 'important' ? 'Important activity' : mode === 'all' ? 'All followed activity' : 'Off'} selected={global.taskMode === mode} onPress={() => update({ taskMode: mode })} />
          ))}
        </SheetSection>

        <SheetSection title="Privacy">
          <SheetRow label="Show sender and work context" selected={global.previewMode === 'context'} onPress={() => update({ previewMode: 'context' })} />
          <SheetRow label="Hide all work context" selected={global.previewMode === 'hidden'} onPress={() => update({ previewMode: 'hidden' })} />
        </SheetSection>

        <SheetSection title="Presentation">
          <SheetRow label="Sound" trailing={<Switch accessibilityLabel="Notification sound" onValueChange={(value) => update({ soundEnabled: value })} value={global.soundEnabled} />} />
          <SheetRow label="Badges" trailing={<Switch accessibilityLabel="Notification badges" onValueChange={(value) => update({ badgesEnabled: value })} value={global.badgesEnabled} />} />
        </SheetSection>

        {__DEV__ ? <SheetSection title="Development diagnostics">
          <SheetRow label="Send test notification" onPress={() => void sendTest()} />
          <SheetRow label="Recent delivery state" trailing={<ThemedText style={{ color: theme.textSecondary }} type="code">{diagnostics ? `${diagnostics.sampleSize} intents` : 'Loading…'}</ThemedText>} />
        </SheetSection> : null}

        <ThemedText style={[styles.footnote, { color: theme.textSecondary }]} type="small">
          Push delivery is best effort. Track records provider acceptance and receipts, but Apple and Google control final device presentation. Payloads contain only the context level selected above.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function PrimaryButton({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: disabled ? theme.hairline : theme.text }]}>
      <ThemedText style={{ color: theme.background }} type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: 10, marginTop: Spacing.one, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.four },
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  footnote: { lineHeight: 19, paddingHorizontal: Spacing.one },
  icon: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  permissionCard: { borderRadius: 14, gap: Spacing.two, padding: Spacing.four },
  screen: { flex: 1 },
});
