import { usePaginatedQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useEffect, useMemo } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { MobileTaskView } from '@/components/task-detail-types';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import {
  attentionAction,
  attentionContext,
  attentionSection,
  attentionTitle,
  relativeAttentionTime,
  uniqueAttentionItems,
  type AttentionSectionKey,
  type MobileAttentionItem,
} from '@/lib/mobile-attention';
import { channelHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { taskDueDisplay } from '@/lib/task-presentation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type GlobalTask = MobileTaskView & {
  project: { _id: Id<'projects'>; name: string };
  companyId?: Id<'companies'>;
  companyName?: string;
  projectMemberId: Id<'projectMembers'>;
};

type HomeFeedRow =
  | { key: string; type: 'section'; title: string; body: string }
  | { key: string; type: 'attention'; item: MobileAttentionItem }
  | { key: string; type: 'task'; item: GlobalTask };

const sectionCopy: Record<AttentionSectionKey, { title: string; body: string }> = {
  priority: { title: 'Priority', body: 'Mentions and direct replies across all your work.' },
  work: { title: 'Task attention', body: 'Assignments and deadlines that changed.' },
  following: { title: 'Following', body: 'Conversation activity you are part of.' },
  other: { title: 'Other attention', body: 'Suggestions and invitations requiring a decision.' },
};

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { openProfileSheet, trackUserId } = useTrackUser();
  const attentionPages = usePaginatedQuery(api.mobile.listAttention, trackUserId
    ? { userId: trackUserId }
    : 'skip', { initialNumItems: 10 });
  const taskPages = usePaginatedQuery(api.mobile.listMyTasks, trackUserId
    ? { userId: trackUserId, openOnly: true }
    : 'skip', { initialNumItems: 10 });
  const attention = attentionPages.results as MobileAttentionItem[];
  const myTasks = useMemo(() => [...taskPages.results as GlobalTask[]].sort((left, right) =>
    (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31') ||
    right.task.updatedAt - left.task.updatedAt,
  ), [taskPages.results]);
  const { loadMore: loadMoreAttention, status: attentionStatus } = attentionPages;
  const { loadMore: loadMoreTasks, status: taskStatus } = taskPages;

  useEffect(() => {
    if (attentionStatus === 'CanLoadMore') loadMoreAttention(10);
  }, [attentionStatus, loadMoreAttention]);
  useEffect(() => {
    if (taskStatus === 'CanLoadMore') loadMoreTasks(10);
  }, [loadMoreTasks, taskStatus]);

  const uniqueAttention = useMemo(() => uniqueAttentionItems(attention ?? []), [attention]);
  const rows = useMemo(() => buildFeedRows(uniqueAttention, myTasks ?? []), [myTasks, uniqueAttention]);
  const loading = attentionStatus === 'LoadingFirstPage' || taskStatus === 'LoadingFirstPage';

  function openAttention(item: MobileAttentionItem) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId && item.membershipId
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const context: RepresentedProjectContext | null = identity
      ? { companyId: identity.companyId, membershipId: identity.membershipId, archived: false }
      : null;
    if (item.kind === 'task') {
      router.push(taskDetailHref(item.projectId, item.taskKey, identity, {
        companyId: item.companyId,
        id: item.id,
        membershipId: item.membershipId,
      }));
      return;
    }
    if (item.kind === 'suggestion') {
      router.push(taskListHref(item.projectId, identity, 'inbox', item.id));
      return;
    }
    if (item.kind === 'invitation') {
      router.push(`/inbox?filter=invitations&invitationId=${encodeURIComponent(item.invitationId)}`);
      return;
    }
    if (item.threadId) {
      router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context, item.messageId) as never);
      return;
    }
    router.push(channelHref(item.projectId, item.groupId, context, item.messageId) as never);
  }

  function openTask(item: GlobalTask) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId
      ? { companyId: item.companyId, membershipId: item.projectMemberId }
      : null;
    router.push(taskDetailHref(item.project._id, item.task.publicKey, identity));
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        headerBackVisible: false,
        headerLeft: () => null,
        title: 'Home',
        headerLargeTitle: false,
        headerTransparent: false,
        headerRight: () => (
          <View style={styles.headerActions}>
            <IconButton accessibilityLabel="Open Inbox" icon="inbox" onPress={() => router.push('/inbox')} />
            <IconButton accessibilityLabel="Open profile" icon="account-circle" onPress={openProfileSheet} />
          </View>
        ),
      }} />
      <ConnectivityBanner style={styles.connection} />
      {loading ? <SkeletonList count={5} label="Loading your work" /> : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={rows}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="display">{greeting()}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
              </ThemedText>
              <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
                  <PlatformIcon color={theme.accentStrong} name="inbox" size={21} />
                </View>
                <View style={styles.summaryBody}>
                  <ThemedText type="title">{uniqueAttention.length} needing attention</ThemedText>
                  <ThemedText themeColor="textSecondary" type="caption">
                    {myTasks?.length ?? 0} open {(myTasks?.length ?? 0) === 1 ? 'task' : 'tasks'} across all Companies and Projects
                  </ThemedText>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="check-circle"
              title="You're clear"
              body="Mentions, replies, assignments, and due work across all your Companies will appear here."
            />
          }
          renderItem={({ item }) => item.type === 'section'
            ? <SectionHeading body={item.body} title={item.title} />
            : item.type === 'attention'
              ? <AttentionRow item={item.item} onPress={() => openAttention(item.item)} />
              : <WorkRow item={item.item} onPress={() => openTask(item.item)} />}
        />
      )}
    </ThemedView>
  );
}

function buildFeedRows(attention: MobileAttentionItem[], tasks: GlobalTask[]): HomeFeedRow[] {
  const rows: HomeFeedRow[] = [];
  const attentionTaskIds = new Set(attention.flatMap((item) => item.kind === 'task' && item.taskId ? [item.taskId] : []));

  for (const section of ['priority', 'work', 'following', 'other'] as const) {
    const items = attention.filter((item) => attentionSection(item) === section);
    if (!items.length) continue;
    rows.push({ key: `section:${section}`, type: 'section', ...sectionCopy[section] });
    rows.push(...items.map((item) => ({ key: `attention:${item.kind}:${item.id}`, type: 'attention' as const, item })));
  }

  const remainingTasks = tasks.filter((item) => !attentionTaskIds.has(item.task._id));
  if (remainingTasks.length) {
    rows.push({ key: 'section:my-work', type: 'section', title: 'My open tasks', body: 'Assigned work ordered by due date.' });
    rows.push(...remainingTasks.map((item) => ({ key: `task:${item.task._id}`, type: 'task' as const, item })));
  }
  return rows;
}

function SectionHeading({ body, title }: { body: string; title: string }) {
  return (
    <View accessibilityRole="header" style={styles.sectionHeading}>
      <ThemedText type="titleLarge">{title}</ThemedText>
      <ThemedText themeColor="textSecondary" type="caption">{body}</ThemedText>
    </View>
  );
}

function AttentionRow({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const direct = item.eventType === 'mention' || item.eventType === 'direct_reply';
  const icon: IconName = item.kind === 'task' ? 'check-circle' : item.kind === 'message' ? 'forum-outline' : item.kind === 'invitation' ? 'account-group' : 'alert-circle';
  const summary = item.kind === 'message' ? item.preview : attentionAction(item);
  const directLabel = item.eventType === 'mention' ? 'Mention' : item.eventType === 'direct_reply' ? 'Reply' : undefined;
  return (
    <AdaptiveListRow
      accessibilityLabel={`${attentionTitle(item)}. ${attentionAction(item)}. ${attentionContext(item)}`}
      emphasized={direct}
      leading={(
        <View style={[styles.rowIcon, { backgroundColor: direct ? theme.backgroundElevated : theme.backgroundSelected }]}>
          <PlatformIcon color={direct ? theme.accentStrong : theme.textSecondary} name={icon} size={20} />
        </View>
      )}
      onPress={onPress}
      subtitle={`${attentionContext(item)} · ${summary}`}
      title={attentionTitle(item)}
      trailingBottom={directLabel ? <ThemedText themeColor="accentStrong" type="captionBold">{directLabel}</ThemedText> : null}
      trailingTop={<ThemedText themeColor="textTertiary" type="caption">{relativeAttentionTime(item.createdAt)}</ThemedText>}
    />
  );
}

function WorkRow({ item, onPress }: { item: GlobalTask; onPress: () => void }) {
  const theme = useTheme();
  const context = [item.companyName, item.project.name, item.task.publicKey].filter(Boolean).join(' · ');
  const due = taskDueDisplay(item.task.dueDate, undefined, item.state?.category)?.label;
  return (
    <AdaptiveListRow
      accessibilityLabel={`${item.task.title}. ${context}`}
      leading={(
        <View style={[styles.rowIcon, { backgroundColor: theme.backgroundSelected }]}>
          <PlatformIcon color={theme.textSecondary} name="check-circle" size={20} />
        </View>
      )}
      onPress={onPress}
      subtitle={context}
      title={item.task.title}
      trailingBottom={<ThemedText themeColor="textSecondary" type="captionBold">{item.state?.name ?? 'Open'}</ThemedText>}
      trailingTop={due ? <ThemedText themeColor="textSecondary" type="caption">{due}</ThemedText> : null}
    />
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  header: { gap: Spacing.two, paddingBottom: Spacing.two },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  list: { gap: Spacing.two, padding: Spacing.four, paddingTop: Spacing.two },
  rowIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  screen: { flex: 1 },
  sectionHeading: { gap: 2, marginTop: Spacing.three, paddingBottom: Spacing.one },
  summary: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one, padding: Spacing.three },
  summaryBody: { flex: 1, gap: 2 },
  summaryIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
});
