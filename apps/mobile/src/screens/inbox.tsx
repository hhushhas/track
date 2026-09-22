import { useMutation, usePaginatedQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ActionButton } from '@/components/action-button';
import { useAppToast } from '@/components/app-toast';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { channelHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { uniqueAttentionIdentities } from '@/lib/mobile-attention';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type AttentionItem = {
  kind: 'task';
  id: Id<'taskNotifications'>;
  projectId: Id<'projects'>;
  projectName: string;
  companyName?: string;
  taskKey: string;
  taskTitle: string;
  eventType: string;
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
  taskId: Id<'tasks'>;
} | {
  kind: 'message';
  id: Id<'messages'>;
  projectId: Id<'projects'>;
  projectName: string;
  companyName?: string;
  groupId: Id<'groups'>;
  groupName: string;
  messageId: Id<'messages'>;
  threadId?: Id<'channelThreads'>;
  threadName?: string;
  senderName: string;
  preview: string;
  eventType: string;
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
} | {
  kind: 'suggestion';
  id: Id<'taskSuggestions'>;
  suggestionId: Id<'taskSuggestions'>;
  projectId: Id<'projects'>;
  projectName: string;
  companyName?: string;
  title: string;
  preview: string;
  eventType: 'task_suggestion';
  createdAt: number;
  companyId?: Id<'companies'>;
  membershipId: Id<'projectMembers'>;
} | {
  kind: 'invitation';
  id: Id<'companyInvitations'>;
  invitationId: Id<'companyInvitations'>;
  companyId: Id<'companies'>;
  projectName: string;
  companyName?: string;
  title: string;
  preview: string;
  eventType: 'company_invitation';
  createdAt: number;
};

type AttentionFilter = 'all' | 'mentions' | 'replies' | 'tasks' | 'suggestions' | 'invitations';

const emptyCopy: Record<AttentionFilter, { body: string; title: string }> = {
  all: { title: "You're clear", body: 'New assignments, mentions, replies, suggestions, and invitations will appear here.' },
  invitations: { title: 'No invitations', body: 'New company invitations will appear here.' },
  mentions: { title: 'No mentions', body: 'Messages that mention you will appear here.' },
  replies: { title: 'No replies', body: 'Direct replies to your conversations will appear here.' },
  suggestions: { title: 'No suggestions', body: 'Grounded task suggestions from your conversations will appear here.' },
  tasks: { title: 'No task updates', body: 'Assignments, due work, and task mentions will appear here.' },
};

function eventCopy(eventType: string) {
  switch (eventType) {
    case 'assignment': return 'You were assigned this task';
    case 'assignment_lost': return 'You are no longer assigned this task';
    case 'mention': return 'You were mentioned on this task';
    case 'due_soon': return 'This task is due soon';
    case 'overdue': return 'This task is overdue';
    case 'task_suggestion': return 'Review grounded task suggestion';
    case 'company_invitation': return 'Company invitation';
    default: return 'This task needs your attention';
  }
}

function relativeTime(createdAt: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - createdAt) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function dayLabel(createdAt: number, now = new Date()) {
  const date = new Date(createdAt);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startToday - startDate) / 86_400_000);
  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function InboxScreen() {
  const { showToast } = useAppToast();
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; invitationId?: string }>();
  const { trackUserId } = useTrackUser();
  const itemPages = usePaginatedQuery(api.mobile.listAttention, trackUserId
    ? { userId: trackUserId }
    : 'skip', { initialNumItems: 10 });
  const items = itemPages.results as AttentionItem[];
  const { loadMore: loadMoreItems, status: itemStatus } = itemPages;
  const decideInvitation = useMutation(api.companies.decideInvitation);
  const markTaskRead = useMutation(api.taskNotifications.markTaskRead);
  const [filter, setFilter] = useState<AttentionFilter>(params.filter === 'invitations' ? 'invitations' : 'all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [invitationBusy, setInvitationBusy] = useState<string | null>(null);
  const visibleItems = useMemo(() => {
    return uniqueAttentionIdentities(items).filter((item) => {
      return filter === 'all'
        || (filter === 'tasks' && item.kind === 'task')
        || (filter === 'mentions' && item.kind === 'message' && item.eventType === 'mention')
        || (filter === 'replies' && item.kind === 'message' && item.eventType === 'direct_reply')
        || (filter === 'suggestions' && item.kind === 'suggestion')
        || (filter === 'invitations' && item.kind === 'invitation');
    })
      .sort((a, b) => {
        const pinnedInvitation = Number(b.kind === 'invitation' && b.invitationId === params.invitationId) -
          Number(a.kind === 'invitation' && a.invitationId === params.invitationId);
        if (pinnedInvitation) return pinnedInvitation;
        const priority = (item: AttentionItem) => item.eventType === 'mention'
          ? 0
          : item.eventType === 'direct_reply'
            ? 1
            : item.kind === 'task'
              ? 2
              : item.kind === 'message'
                ? 3
                : 4;
        return priority(a) - priority(b) || b.createdAt - a.createdAt;
      });
  }, [filter, items, params.invitationId]);

  function openItem(item: AttentionItem) {
    hapticLight();
    if (item.kind === 'task') {
      void markTaskRead({
        taskId: item.taskId,
        actingCompanyId: item.companyId,
        projectMemberId: item.companyId ? item.membershipId : undefined,
      }).catch(() => undefined);
    }
    const identity: MobileTaskIdentity | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const context: RepresentedProjectContext | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId, archived: false }
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
      router.push(taskListHref(item.projectId, identity, 'inbox', item.suggestionId));
      return;
    }
    if (item.kind === 'invitation') {
      router.push('/company');
      return;
    }
    if (item.threadId) {
      router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context, item.messageId) as never);
      return;
    }
    router.push(channelHref(item.projectId, item.groupId, context, item.messageId) as never);
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Inbox',
        headerLargeTitle: false,
        headerTransparent: false,
        headerRight: () => <IconButton accessibilityLabel="Notification settings" icon="bell-outline" onPress={() => router.push('/notifications')} />,
      }} />
      <ConnectivityBanner style={styles.connection} />
      {itemStatus === 'LoadingFirstPage' ? <ScreenEntrance style={styles.screenContent}><SkeletonList label="Loading attention" /></ScreenEntrance> : (
        <ScreenEntrance style={styles.screenContent}><FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={visibleItems}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          renderItem={({ index, item }) => {
            const section = dayLabel(item.createdAt);
            const previousSection = index > 0 && visibleItems
              ? dayLabel(visibleItems[index - 1].createdAt)
              : null;
            return (
              <View style={styles.daySection}>
                {section !== previousSection ? (
                  <ThemedText accessibilityRole="header" style={styles.dayHeading} themeColor="textSecondary" type="captionBold">
                    {section}
                  </ThemedText>
                ) : null}
                <AttentionRow
                  invitationBusy={invitationBusy}
                  item={item}
                  onInvitationDecision={(invitationId, decision) => {
                    setInvitationBusy(`${invitationId}:${decision}`);
                    void decideInvitation({ invitationId, decision })
                      .then((result) => {
                        if (typeof result === 'object' && result !== null && 'status' in result && result.status === 'expired') {
                          throw new Error('invitation_expired');
                        }
                        showToast({ title: decision === 'accept' ? 'Company joined' : 'Invitation declined', tone: 'success' });
                      })
                      .catch(() => showToast({ title: 'Invitation unavailable', message: 'It expired or your access changed.', tone: 'error' }))
                      .finally(() => setInvitationBusy(null));
                  }}
                  onPress={() => openItem(item)}
                />
              </View>
            );
          }}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.intro}>
                <ThemedText themeColor="textSecondary">Mentions, replies, and assigned work across every Company and Project.</ThemedText>
              </View>
              <View accessibilityRole="tablist" style={styles.filters}>
                {(['all', 'mentions', 'replies', 'tasks'] as const).map((value) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === value }}
                    key={value}
                    onPress={() => setFilter(value)}
                    style={[styles.filter, filter === value && { backgroundColor: theme.accentSoft }]}
                  >
                    <ThemedText themeColor={filter === value ? 'accentStrong' : 'text'} type="captionBold">{value === 'all' ? 'All' : value === 'mentions' ? 'Mentions' : value === 'replies' ? 'Replies' : 'Tasks'}</ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityLabel="More Inbox filters"
                  accessibilityRole="button"
                  onPress={() => setFilterSheetOpen(true)}
                  style={[styles.filter, (filter === 'suggestions' || filter === 'invitations') && { backgroundColor: theme.accentSoft }]}
                >
                  <ThemedText themeColor={filter === 'suggestions' || filter === 'invitations' ? 'accentStrong' : 'text'} type="captionBold">{filter === 'suggestions' ? 'Suggestions' : filter === 'invitations' ? 'Invitations' : 'More'}</ThemedText>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="check-circle"
              title={emptyCopy[filter].title}
              body={emptyCopy[filter].body}
            />
          }
          ListFooterComponent={itemStatus === 'LoadingMore' ? <View style={styles.footer}><ActivityIndicator color={theme.accentStrong} /></View> : null}
          onEndReached={() => { if (itemStatus === 'CanLoadMore') loadMoreItems(10); }}
          onEndReachedThreshold={0.6}
        /></ScreenEntrance>
      )}
      <OptionsSheet onClose={() => setFilterSheetOpen(false)} title="Filter Inbox" visible={filterSheetOpen}>
        <SheetSection title="Show">
          {([
            ['all', 'All attention', 'inbox'],
            ['mentions', 'Mentions', 'message'],
            ['replies', 'Direct replies', 'reply'],
            ['tasks', 'Task updates', 'task'],
            ['suggestions', 'Task suggestions', 'lightbulb-outline'],
            ['invitations', 'Invitations', 'account-group'],
          ] as const).map(([key, label, icon]) => (
            <SheetRow
              icon={icon}
              key={key}
              label={label}
              selected={filter === key}
              onPress={() => { setFilter(key); setFilterSheetOpen(false); }}
            />
          ))}
        </SheetSection>
      </OptionsSheet>
    </ThemedView>
  );
}

function AttentionRow({ invitationBusy, item, onInvitationDecision, onPress }: {
  invitationBusy: string | null;
  item: AttentionItem;
  onInvitationDecision: (invitationId: Id<'companyInvitations'>, decision: 'accept' | 'decline') => void;
  onPress: () => void;
}) {
  const theme = useTheme();
  const invitationBusyForItem = Boolean(item.kind === 'invitation'
    && invitationBusy?.startsWith(`${item.invitationId}:`));
  if (item.kind !== 'invitation') {
    const notificationTone = item.kind === 'message'
      ? item.eventType === 'mention'
        ? { background: theme.workflowBacklogSoft, foreground: theme.workflowBacklog }
        : { background: theme.backgroundElement, foreground: theme.info }
      : item.kind === 'suggestion'
        ? { background: theme.accentSoft, foreground: theme.accentStrong }
        : item.eventType === 'overdue'
          ? { background: theme.dangerSoft, foreground: theme.danger }
          : { background: theme.backgroundElement, foreground: theme.textSecondary };
    const title = item.kind === 'task' ? item.taskTitle : item.kind === 'message' ? `${item.senderName}: ${item.preview}` : item.title;
    const state = item.kind === 'task'
      ? eventCopy(item.eventType)
      : item.kind === 'message'
        ? item.eventType === 'mention' ? 'Mention' : item.eventType === 'direct_reply' ? 'Reply' : 'Unread'
        : 'Suggestion';
    const context = [
      item.companyName,
      item.projectName,
      item.kind === 'task' ? 'Task' : item.kind === 'message' ? `#${item.groupName}` : 'Suggestion',
    ].filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index).join(' · ');
    const direct = item.kind === 'message' && (item.eventType === 'mention' || item.eventType === 'direct_reply');
    const threadId = item.kind === 'message' ? item.threadId : undefined;
    const sourceLabel = item.kind === 'message' ? threadId ? 'Thread reply' : 'Channel message' : null;
    return (
      <AdaptiveListRow
        accessibilityHint={item.kind === 'message' ? item.threadId ? 'Opens the conversation thread' : 'Opens the Channel message' : 'Opens the attention item'}
        accessibilityLabel={`${title}. ${context}. ${sourceLabel ? `${sourceLabel}. ` : ''}${state}`}
        emphasized={direct}
        leading={(
          <View style={[styles.iconWrap, { backgroundColor: notificationTone.background }]}>
            <PlatformIcon color={notificationTone.foreground} name={item.kind === 'task' ? 'task' : item.kind === 'message' ? 'message' : 'inbox'} size={20} />
          </View>
        )}
        onPress={onPress}
        subtitle={(
          <View style={styles.sourceMeta}>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{context}</ThemedText>
            {sourceLabel ? <View style={[styles.sourcePill, { backgroundColor: threadId ? theme.accentSoft : theme.backgroundElement, borderColor: theme.hairline }]}>
              <PlatformIcon color={threadId ? theme.accentStrong : theme.textSecondary} name={threadId ? 'thread' : 'channel'} size={13} />
              <ThemedText themeColor={threadId ? 'accentStrong' : 'textSecondary'} type="captionBold">{sourceLabel}</ThemedText>
            </View> : null}
          </View>
        )}
        title={title}
        trailingBottom={<ThemedText style={{ color: notificationTone.foreground }} type="captionBold">{state}</ThemedText>}
        trailingTop={<ThemedText themeColor="textTertiary" type="caption">{relativeTime(item.createdAt)}</ThemedText>}
      />
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}: ${item.preview}`}
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={onPress}
        style={styles.cardPressable}>
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name="office-building" size={20} />
        </View>
        <View style={styles.body}>
          <View style={styles.metaRow}>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold" style={styles.project}>
              {[item.companyName, item.projectName, 'Invitation'].filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index).join(' · ')}
            </ThemedText>
            <ThemedText themeColor="textTertiary" type="caption">{relativeTime(item.createdAt)}</ThemedText>
          </View>
          <ThemedText numberOfLines={2} type="title">{item.title}</ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
            {item.preview}
          </ThemedText>
        </View>
        <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
      </Pressable>
      <View style={styles.invitationActions}>
          <ActionButton
            disabled={invitationBusyForItem}
            label="Decline"
            loading={invitationBusy === `${item.invitationId}:decline`}
            onPress={() => onInvitationDecision(item.invitationId, 'decline')}
            style={styles.invitationButton}
            variant="secondary"
          />
          <ActionButton
            disabled={invitationBusyForItem}
            label="Accept"
            loading={invitationBusy === `${item.invitationId}:accept`}
            onPress={() => onInvitationDecision(item.invitationId, 'accept')}
            style={styles.invitationButton}
          />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  dayHeading: { marginBottom: Spacing.one, marginTop: Spacing.two },
  daySection: { gap: Spacing.one },
  body: { flex: 1, gap: 2, minWidth: 0 },
  card: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardPressable: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 76, padding: Spacing.three },
  filter: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  footer: { alignItems: 'center', minHeight: TouchTarget, paddingVertical: Spacing.two },
  header: { gap: Spacing.two },
  iconWrap: { alignItems: 'center', borderRadius: Radius.medium, height: 40, justifyContent: 'center', width: 40 },
  invitationActions: { borderTopColor: 'rgba(128,128,128,0.18)', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, justifyContent: 'flex-end', padding: Spacing.two },
  invitationButton: { flex: 1, paddingHorizontal: Spacing.three },
  intro: { gap: Spacing.one, paddingBottom: Spacing.two },
  list: { gap: Spacing.two, padding: Spacing.four, paddingTop: Spacing.two },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  project: { flex: 1 },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  sourceMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  sourcePill: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.two, paddingVertical: 3 },
});
