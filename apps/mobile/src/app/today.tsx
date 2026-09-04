import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { channelHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type AttentionItem = {
  kind: 'task';
  id: Id<'taskNotifications'>;
  taskId?: Id<'tasks'>;
  projectId: Id<'projects'>;
  projectName: string;
  taskKey: string;
  taskTitle: string;
  eventType: string;
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
} | {
  kind: 'message';
  id: Id<'messages'>;
  projectId: Id<'projects'>;
  projectName: string;
  groupId: Id<'groups'>;
  groupName: string;
  messageId: Id<'messages'>;
  threadId?: Id<'channelThreads'>;
  senderName: string;
  preview: string;
  eventType: string;
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
} | {
  kind: 'suggestion';
  id: Id<'taskSuggestions'>;
  projectId: Id<'projects'>;
  projectName: string;
  title: string;
  preview: string;
  eventType: 'task_suggestion';
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
} | {
  kind: 'invitation';
  id: Id<'companyInvitations'>;
  companyId: Id<'companies'>;
  projectName: string;
  title: string;
  preview: string;
  eventType: 'company_invitation';
  createdAt: number;
};

function itemTitle(item: AttentionItem) {
  if (item.kind === 'task') return item.taskTitle;
  if (item.kind !== 'message') return item.title;
  return item.eventType === 'mention'
    ? `${item.senderName} mentioned you`
    : `${item.senderName} replied to you`;
}

function itemDetail(item: AttentionItem) {
  if (item.kind === 'task') return `${item.projectName} · ${item.taskKey}`;
  if (item.kind !== 'message') return item.projectName;
  return `${item.projectName} · ${item.groupName}`;
}

function eventCopy(item: AttentionItem) {
  if (item.kind === 'message') return item.eventType === 'mention' ? 'Review mention' : 'Reply to thread';
  if (item.kind === 'suggestion') return 'Review task suggestion';
  if (item.kind === 'invitation') return 'Review company invitation';
  switch (item.eventType) {
    case 'assignment': return 'You were assigned this task';
    case 'due_soon': return 'This task is due soon';
    case 'overdue': return 'This task is overdue';
    default: return 'This task needs your attention';
  }
}

export default function TodayScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId } = useCompany();
  const items = useQuery(api.mobile.listAttention, trackUserId
    ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined }
    : 'skip') as AttentionItem[] | undefined;
  const markRead = useMutation(api.taskNotifications.markRead);
  const markGroupRead = useMutation(api.mobile.markGroupRead);
  const markThreadRead = useMutation(api.channelThreads.markRead);

  function openItem(item: AttentionItem) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const context: RepresentedProjectContext | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId, archived: false }
      : null;
    if (item.kind === 'task') {
      void markRead({ notificationId: item.id, actingCompanyId: item.companyId, projectMemberId: item.membershipId }).catch(() => undefined);
      router.push(taskDetailHref(item.projectId, item.taskKey, identity));
      return;
    }
    if (item.kind === 'suggestion' || item.kind === 'invitation') {
      router.push('/inbox');
      return;
    }
    if (item.threadId) {
      void markThreadRead({ threadId: item.threadId, userId: trackUserId!, actingCompanyId: item.companyId, projectMemberId: item.membershipId }).catch(() => undefined);
      router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context, item.messageId));
      return;
    }
    void markGroupRead({ groupId: item.groupId, userId: trackUserId!, actingCompanyId: item.companyId, projectMemberId: item.membershipId, lastReadMessageId: item.messageId }).catch(() => undefined);
    router.push(channelHref(item.projectId, item.groupId, context, item.messageId));
  }

  const homeItems = uniqueHomeItems(items ?? []).slice(0, 3);
  const homeItemCount = uniqueHomeItems(items ?? []).length;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ headerBackVisible: false, headerLeft: () => null, title: 'Home', headerLargeTitle: false, headerTransparent: false }} />
      {items === undefined ? <SkeletonList label="Loading Home" /> : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={homeItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AttentionRow item={item} onPress={() => openItem(item)} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="display">Good morning</ThemedText>
              <ThemedText themeColor="textSecondary">A clear view of the next useful action.</ThemedText>
              {homeItemCount > 0 ? (
                <View style={[styles.summary, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline, borderWidth: StyleSheet.hairlineWidth }]}>
                  <PlatformIcon color={theme.accentStrong} name="alert-circle" size={20} />
                  <View style={styles.summaryBody}>
                    <ThemedText type="title">{homeItemCount > 3 ? '3+' : homeItemCount} {homeItemCount === 1 ? 'thing' : 'things'} need your attention</ThemedText>
                    <ThemedText themeColor="textSecondary" type="caption">Start with the item that can move work forward.</ThemedText>
                  </View>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={homeItemCount > homeItems.length ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/inbox')} style={[styles.primaryButton, { backgroundColor: theme.text }]}>
              <ThemedText style={{ color: theme.background }} type="smallBold">Review all attention</ThemedText>
            </Pressable>
          ) : null}
          ListEmptyComponent={<EmptyState icon="check-circle" title="You're clear" body="New assignments, mentions, and task updates will appear here." />}
        />
      )}
      <PrimaryNavigation />
    </ThemedView>
  );
}

function uniqueHomeItems(items: AttentionItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.kind === 'task' && item.taskId
      ? `task:${item.taskId}`
      : `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function AttentionRow({ item, onPress }: { item: AttentionItem; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${itemTitle(item)}. ${eventCopy(item)}`} android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name={item.kind === 'task' ? 'check-circle' : 'bell-outline'} size={20} /></View>
        <View style={styles.body}>
          <ThemedText numberOfLines={1} type="captionBold" themeColor="textSecondary">{itemDetail(item)}</ThemedText>
          <ThemedText numberOfLines={2} type="title">{itemTitle(item)}</ThemedText>
          <ThemedText numberOfLines={1} type="caption" themeColor="textSecondary">{item.kind === 'message' ? item.preview : eventCopy(item)}</ThemedText>
        </View>
        <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 2, minWidth: 0 },
  card: { borderRadius: Radius.large, overflow: 'hidden' },
  header: { gap: Spacing.two, paddingBottom: Spacing.two },
  iconWrap: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  list: { gap: Spacing.two, padding: Spacing.three, paddingTop: Spacing.two },
  primaryButton: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 82, padding: Spacing.three },
  screen: { flex: 1 },
  summary: { alignItems: 'center', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  summaryBody: { flex: 1, gap: 2 },
});
