import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
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
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type AttentionItem = {
  kind: 'task';
  id: Id<'taskNotifications'>;
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
  invitationId: Id<'companyInvitations'>;
  companyId: Id<'companies'>;
  projectName: string;
  title: string;
  preview: string;
  eventType: 'company_invitation';
  createdAt: number;
};

type AttentionFilter = 'all' | 'mentions' | 'replies' | 'tasks' | 'suggestions' | 'invitations';

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

export default function InboxScreen() {
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
  const decideInvitation = useMutation(api.companies.decideInvitation);
  const [filter, setFilter] = useState<AttentionFilter>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [invitationBusy, setInvitationBusy] = useState<string | null>(null);
  const visibleItems = useMemo(() => {
    if (!items) return undefined;
    return items.filter((item) => filter === 'all'
      || (filter === 'tasks' && item.kind === 'task')
      || (filter === 'mentions' && item.kind === 'message' && item.eventType === 'mention')
      || (filter === 'replies' && item.kind === 'message' && item.eventType === 'direct_reply')
      || (filter === 'suggestions' && item.kind === 'suggestion')
      || (filter === 'invitations' && item.kind === 'invitation'));
  }, [filter, items]);

  function openItem(item: AttentionItem) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const context: RepresentedProjectContext | null = item.companyId && item.kind !== 'invitation'
      ? { companyId: item.companyId, membershipId: item.membershipId, archived: false }
      : null;
    if (item.kind === 'task') {
      void markRead({
        notificationId: item.id,
        actingCompanyId: item.companyId,
        projectMemberId: item.membershipId,
      }).catch(() => undefined);
      router.push(taskDetailHref(item.projectId, item.taskKey, identity));
      return;
    }
    if (item.kind === 'suggestion') {
      router.push(taskListHref(item.projectId, identity, 'inbox'));
      return;
    }
    if (item.kind === 'invitation') {
      router.push('/company');
      return;
    }
    if (item.threadId) {
      void markThreadRead({
        threadId: item.threadId,
        userId: trackUserId!,
        actingCompanyId: item.companyId,
        projectMemberId: item.membershipId,
      }).catch(() => undefined);
      router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context, item.messageId));
      return;
    }
    void markGroupRead({
      groupId: item.groupId,
      userId: trackUserId!,
      actingCompanyId: item.companyId,
      projectMemberId: item.membershipId,
      lastReadMessageId: item.messageId,
    }).catch(() => undefined);
    router.push(channelHref(item.projectId, item.groupId, context, item.messageId));
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Inbox',
        headerLargeTitle: Platform.OS === 'ios',
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'systemMaterial',
      }} />
      {items === undefined ? <SkeletonList label="Loading attention" /> : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AttentionRow
            invitationBusy={invitationBusy}
            item={item}
            onInvitationDecision={(invitationId, decision) => {
              setInvitationBusy(String(invitationId));
              void decideInvitation({ invitationId, decision })
                .then(() => Alert.alert(decision === 'accept' ? 'Company joined' : 'Invitation declined'))
                .catch(() => Alert.alert('Invitation unavailable', 'It expired or your access changed.'))
                .finally(() => setInvitationBusy(null));
            }}
            onPress={() => openItem(item)}
          />}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.intro}>
                <ThemedText type="display">Your attention</ThemedText>
                <ThemedText themeColor="textSecondary">A calm queue of work that changed and needs a response.</ThemedText>
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
              title="You're clear"
              body="New assignments, mentions, and task reminders will appear here."
            />
          }
        />
      )}
      <OptionsSheet onClose={() => setFilterSheetOpen(false)} title="Filter Inbox" visible={filterSheetOpen}>
        <SheetSection title="Show">
          <SheetRow icon="bell-outline" label="Suggestions" selected={filter === 'suggestions'} onPress={() => { setFilter('suggestions'); setFilterSheetOpen(false); }} />
          <SheetRow icon="account-group" label="Invitations" selected={filter === 'invitations'} onPress={() => { setFilter('invitations'); setFilterSheetOpen(false); }} />
          <SheetRow icon="inbox" label="All attention" selected={filter === 'all'} onPress={() => { setFilter('all'); setFilterSheetOpen(false); }} />
        </SheetSection>
      </OptionsSheet>
      <PrimaryNavigation />
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
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.kind === 'task'
          ? `${eventCopy(item.eventType)}: ${item.taskTitle}`
          : item.kind === 'message'
            ? `${item.senderName} ${item.eventType === 'mention' ? 'mentioned you' : 'replied to you'}`
            : `${item.title}: ${item.preview}`}
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={onPress}
        style={styles.cardPressable}>
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name={item.kind === 'task' ? 'check-circle' : 'bell-outline'} size={20} />
        </View>
        <View style={styles.body}>
          <View style={styles.metaRow}>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold" style={styles.project}>
              {item.projectName} · {item.kind === 'task' ? 'Task' : item.kind === 'message' ? item.groupName : item.kind === 'suggestion' ? 'Suggestion' : 'Invitation'}
            </ThemedText>
            <ThemedText themeColor="textTertiary" type="caption">{relativeTime(item.createdAt)}</ThemedText>
          </View>
          <ThemedText numberOfLines={2} type="title">{item.kind === 'task' ? item.taskTitle : item.kind === 'message' ? `${item.senderName}: ${item.preview}` : item.title}</ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
            {item.kind === 'task' ? eventCopy(item.eventType) : item.kind === 'message' ? item.eventType === 'mention' ? 'Mentioned you' : 'Replied to you' : item.preview}
          </ThemedText>
        </View>
        <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
      </Pressable>
      {item.kind === 'invitation' ? (
        <View style={styles.invitationActions}>
          <Pressable
            accessibilityRole="button"
            disabled={invitationBusy === String(item.invitationId)}
            onPress={() => onInvitationDecision(item.invitationId, 'decline')}
            style={styles.invitationButton}>
            <ThemedText themeColor="textSecondary" type="captionBold">Decline</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={invitationBusy === String(item.invitationId)}
            onPress={() => onInvitationDecision(item.invitationId, 'accept')}
            style={styles.invitationButton}>
            <ThemedText type="captionBold">{invitationBusy === String(item.invitationId) ? 'Working…' : 'Accept'}</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 2, minWidth: 0 },
  card: { borderRadius: Radius.large, overflow: 'hidden' },
  cardPressable: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 76, padding: Spacing.three },
  filter: { alignItems: 'center', borderRadius: Radius.pill, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  filters: { flexDirection: 'row', gap: Spacing.one },
  header: { gap: Spacing.two },
  iconWrap: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  invitationActions: { borderTopColor: 'rgba(128,128,128,0.18)', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, justifyContent: 'flex-end', padding: Spacing.two },
  invitationButton: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  intro: { gap: Spacing.one, paddingBottom: Spacing.two },
  list: { gap: Spacing.two, padding: Spacing.three, paddingTop: Spacing.two },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  project: { flex: 1 },
  screen: { flex: 1 },
});
