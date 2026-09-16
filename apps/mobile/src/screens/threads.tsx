import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { useReleaseConfig } from '@/lib/release-config';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { threadConversationHref } from '@/lib/thread-navigation';
import { communicationErrorMessage } from '@/lib/user-facing-error';

type ThreadListRow = {
  key: string;
  groupId: Id<'groups'> | undefined;
  threadId: Id<'channelThreads'>;
  messageId?: Id<'messages'>;
  title: string;
  subtitle: string;
  preview: string;
  channelName: string;
  replyCount: number;
  lastActivity: number | null;
  following: boolean;
  unread: boolean;
};

type ThreadFilter = 'all' | 'following' | 'unread' | 'recent';

const threadFilters: Array<{ key: ThreadFilter; label: string; icon: 'thread' | 'bell-outline' | 'email-outline' | 'clock-outline' }> = [
  { key: 'all', label: 'All threads', icon: 'thread' },
  { key: 'following', label: 'Following', icon: 'bell-outline' },
  { key: 'unread', label: 'Unread', icon: 'email-outline' },
  { key: 'recent', label: 'Recent activity', icon: 'clock-outline' },
];

function relativeTime(timestamp: number | null) {
  if (!timestamp) return 'No activity';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ThreadsScreen() {
  const theme = useTheme();
  const network = useNetworkState();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const releaseConfig = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const { groupId, projectId, companyId, membershipId, archive, sourceMessageId } = useLocalSearchParams<{
    groupId: string;
    projectId: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    sourceMessageId?: string;
  }>();
  const gid = groupId as Id<'groups'> | undefined;
  const pid = projectId as Id<'projects'> | undefined;
  const cid = companyId as Id<'companies'> | undefined;
  const pmid = membershipId as Id<'projectMembers'> | undefined;
  const sourceId = sourceMessageId as Id<'messages'> | undefined;
  const context = cid && pmid ? { companyId: cid, membershipId: pmid, archived: archive === '1' } : null;
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(Boolean(sourceId));
  const [error, setError] = useState<string | null>(null);
  const createKey = useRef<string | null>(null);
  const createThread = useMutation(api.channelThreads.create);
  const navigation = useQuery(
    api.mobile.resolveNavigation,
    releaseConfig.threads && trackUserId && pid && gid
      ? { userId: trackUserId, projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid }
      : 'skip',
  );
  const groups = useQuery(
    api.mobile.listGroups,
    releaseConfig.threads && trackUserId && pid && navigation?.available
      ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid }
      : 'skip',
  );
  const threadPage = usePaginatedQuery(
    api.channelThreads.listPage,
    releaseConfig.threads && trackUserId && gid && navigation?.available
      ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, status }
      : 'skip',
    { initialNumItems: 50 },
  );
  const threads = threadPage.status === 'LoadingFirstPage' ? undefined : threadPage.results;
  const searchTerm = searchQuery.trim();
  const searchResults = useQuery(
    api.search.project,
    releaseConfig.threads && trackUserId && pid && navigation?.available && searchTerm.length >= 2
      ? {
          userId: trackUserId,
          projectId: pid,
          actingCompanyId: cid,
          projectMemberId: pmid,
          filter: 'all',
          limit: 12,
          query: searchTerm,
        }
      : 'skip',
  );
  const searchActive = searchTerm.length >= 2;
  const channelName = groups?.find((item) => item.group._id === gid)?.group.name ?? 'Channel';
  const rows = useMemo<ThreadListRow[]>(() => searchActive
    ? [
        ...(searchResults?.threads ?? []).map((item) => ({
          key: `thread-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: undefined,
          title: item.title,
          subtitle: `${item.preview} · ${item.groupName}`,
          preview: item.preview ?? 'No preview available',
          channelName: item.groupName,
          replyCount: 0,
          lastActivity: null,
          following: false,
          unread: false,
        })),
        ...(searchResults?.messages ?? []).flatMap((item) => item.threadId ? [{
          key: `message-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: item.messageId,
          title: item.threadName ?? 'Thread reply',
          subtitle: item.preview,
          preview: item.preview ?? 'No preview available',
          channelName: 'Thread reply',
          replyCount: 0,
          lastActivity: null,
          following: false,
          unread: false,
        }] : []),
        ...(searchResults?.files ?? []).flatMap((item) => item.threadId ? [{
          key: `file-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: item.messageId,
          title: item.title,
          subtitle: `${item.threadName ?? 'Thread attachment'} · ${item.groupName}`,
          preview: item.title,
          channelName: item.groupName,
          replyCount: 0,
          lastActivity: null,
          following: false,
          unread: false,
        }] : []),
      ]
    : (threads ?? []).map((item) => ({
        key: `thread-${item.thread._id}`,
        groupId: gid,
        threadId: item.thread._id,
        messageId: undefined,
        title: item.thread.name,
        subtitle: `${item.replyCount} ${item.replyCount === 1 ? 'reply' : 'replies'}${item.following ? ' · Following' : ''}`,
        preview: item.latestReplyPreview ?? (item.source && 'body' in item.source ? item.source.body ?? 'Attachment message' : 'No replies yet'),
        channelName,
        replyCount: item.replyCount,
        lastActivity: item.latestReplyAt ?? item.thread.updatedAt ?? item.thread.createdAt,
        following: item.following,
        unread: item.unread,
      })), [channelName, searchActive, searchResults, threads]);
  const visibleRows = useMemo(() => {
    if (searchActive || threadFilter === 'all') return rows;
    if (threadFilter === 'following') return rows.filter((item) => item.following);
    if (threadFilter === 'unread') return rows.filter((item) => item.unread);
    return [...rows].sort((left, right) => (right.lastActivity ?? 0) - (left.lastActivity ?? 0));
  }, [rows, searchActive, threadFilter]);
  const filterLabel = threadFilters.find((item) => item.key === threadFilter)?.label ?? 'All threads';
  const readOnly = archive === '1' || navigation?.archived === true;

  async function submit() {
    const trimmedName = name.trim();
    if (!trackUserId || !pid || !gid || trimmedName.length < 2 || trimmedName.length > 100) {
      setError('Thread name must be 2–100 characters');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      createKey.current ??= idempotencyKey();
      const threadId = await createThread({
        projectId: pid,
        groupId: gid,
        creatorId: trackUserId,
        actingCompanyId: cid,
        projectMemberId: pmid,
        sourceMessageId: sourceId,
        idempotencyKey: createKey.current,
        name: trimmedName,
      });
      createKey.current = null;
      setCreateOpen(false);
      router.replace(threadConversationHref(pid, gid, threadId, context) as never);
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'start this thread'));
    } finally {
      setSaving(false);
    }
  }

  if (!releaseConfig.threads || (navigation && !navigation.available)) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread unavailable' }} /><EmptyState body="Thread unavailable or access changed." icon="thread" title="Unavailable" /></ThemedView>;
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Threads',
        headerRight: () => !readOnly && status === 'active' ? <IconButton accessibilityLabel="Start a new thread" icon="plus" onPress={() => { setError(null); setName(''); setCreateOpen(true); }} /> : null,
      }} />
      <View style={[styles.context, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
        <View style={[styles.contextIcon, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name="channel" size={18} />
        </View>
        <View style={styles.contextCopy}>
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">{navigation?.project?.name ?? 'Project'}</ThemedText>
          <ThemedText numberOfLines={1} type="smallBold">{channelName} · Focused discussions</ThemedText>
        </View>
      </View>
      <View style={[styles.tabs, { borderBottomColor: theme.hairline }]}>
        {(['active', 'archived'] as const).map((value) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: status === value }}
            key={value}
            onPress={() => { hapticLight(); setStatus(value); }}
            style={[styles.tab, { borderBottomColor: status === value ? theme.accent : 'transparent' }]}>
            <ThemedText type="title">{value === 'active' ? 'Active' : 'Archived'}</ThemedText>
          </Pressable>
        ))}
      </View>
      {sourceId ? <View style={[styles.sourceNotice, { backgroundColor: theme.backgroundElement }]}><ThemedText type="small">Starting from the selected Channel message.</ThemedText></View> : null}
      {readOnly ? <View style={[styles.archiveNotice, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="archive" size={17} /><View style={styles.contextCopy}><ThemedText type="smallBold">Archived Channel</ThemedText><ThemedText themeColor="textSecondary" type="caption">Threads are read-only while this Channel is archived.</ThemedText></View></View> : null}
      <ConnectivityBanner style={styles.connection} />
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, { borderColor: theme.hairline, backgroundColor: theme.backgroundElement }]}>
          <PlatformIcon color={theme.textTertiary} name="search" size={18} />
          <TextInput
            accessibilityLabel="Search threads and replies"
            autoCapitalize="none"
            autoCorrect={false}
            cursorColor={theme.accent}
            maxLength={200}
            maxFontSizeMultiplier={MaxFontScale}
            onChangeText={setSearchQuery}
            placeholder="Search threads and replies"
            placeholderTextColor={theme.textTertiary}
            selectionColor={theme.accent}
            selectionHandleColor={theme.accent}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
          />
        </View>
        <Pressable
          accessibilityLabel={`Thread filter: ${filterLabel}`}
          accessibilityRole="button"
          onPress={() => { hapticLight(); setFilterOpen(true); }}
          style={({ pressed }) => [styles.filterButton, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}>
          <PlatformIcon color={theme.textSecondary} name="filter" size={17} />
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">{filterLabel}</ThemedText>
        </Pressable>
      </View>
      {error ? <ThemedText accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]} type="small">{error}. Retry keeps the same request.</ThemedText> : null}
      <ScreenEntrance style={styles.screenContent}><FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
        data={visibleRows}
        onEndReached={() => { if (threadPage.status === 'CanLoadMore') threadPage.loadMore(50); }}
        onEndReachedThreshold={0.5}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={(searchActive ? searchResults : threads) === undefined
          ? <SkeletonList count={3} label={searchActive ? 'Searching' : 'Loading threads'} />
          : <EmptyState body={searchActive ? `No thread results for “${searchTerm}”.` : network.isConnected === false ? 'Reconnect to load this Channel’s discussions.' : threadFilter === 'following' ? 'Follow a thread to keep it here.' : threadFilter === 'unread' ? 'You’re caught up.' : `No ${status} threads in this Channel.`} icon="thread" title={searchActive ? 'No results' : threadFilter === 'following' ? 'No followed threads' : threadFilter === 'unread' ? 'No unread threads' : 'No threads'} />}
        renderItem={({ item }) => (
          <AdaptiveListRow
            accessibilityHint={item.unread ? 'Opens this unread followed thread' : 'Opens this thread'}
            accessibilityLabel={`${item.title}. ${item.channelName}. ${item.preview}. ${item.replyCount} replies. ${relativeTime(item.lastActivity)}${item.unread ? '. Unread' : ''}`}
            emphasized={item.unread}
            leading={(
              <View style={[styles.threadIcon, { backgroundColor: item.unread ? theme.backgroundElevated : theme.backgroundSelected }]}>
                <PlatformIcon color={item.unread ? theme.accentStrong : theme.textSecondary} name="thread" size={19} variant={item.unread ? 'filled' : 'outline'} />
              </View>
            )}
            onPress={() => pid && item.groupId && item.threadId && router.push(threadConversationHref(pid, item.groupId, item.threadId, context, item.messageId) as never)}
            subtitle={(
              <View style={styles.rowCopy}>
                <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{item.channelName} · {item.preview}</ThemedText>
                <View style={styles.rowMeta}>
                  <ThemedText themeColor="textTertiary" type="caption">{item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'} · {relativeTime(item.lastActivity)}</ThemedText>
                  {item.following ? <ThemedText style={{ color: theme.accentStrong }} type="captionBold">Following</ThemedText> : null}
                </View>
              </View>
            )}
            title={item.title}
            trailingBottom={item.unread ? <ThemedText style={{ color: theme.accentStrong }} type="captionBold">Unread</ThemedText> : null}
            trailingTop={!item.unread ? <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} /> : null}
          />
        )}
      /></ScreenEntrance>
      <OptionsSheet onClose={() => setFilterOpen(false)} title="Thread filters" visible={filterOpen}>
        <SheetSection>
          {threadFilters.map((filter) => <SheetRow
            icon={filter.icon}
            key={filter.key}
            label={filter.label}
            onPress={() => { setThreadFilter(filter.key); setFilterOpen(false); }}
            selected={threadFilter === filter.key}
          />)}
        </SheetSection>
      </OptionsSheet>
      <OptionsSheet onClose={() => { if (!saving) setCreateOpen(false); }} title="Start thread" visible={createOpen}>
        {sourceId ? <View style={[styles.sourceNotice, { backgroundColor: theme.backgroundElement }]}><ThemedText type="small">The selected Channel message will be the thread source.</ThemedText></View> : null}
        <SheetInput autoFocus label="Thread name" maxLength={100} onChangeText={(value) => { setName(value); if (error) setError(null); }} placeholder="What should this discussion focus on?" value={name} />
        <ThemedText style={styles.counter} themeColor="textTertiary" type="caption">{name.trim().length}/100 · Use a short, specific focus</ThemedText>
        {error ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }} type="small">{error}. Retry keeps the same request.</ThemedText> : null}
        <ActionButton disabled={saving || name.trim().length < 2} label="Start thread" loading={saving} onPress={() => void submit()} />
      </OptionsSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  archiveNotice: { alignItems: 'center', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.two, margin: Spacing.three, marginBottom: 0, padding: Spacing.three },
  context: { alignItems: 'center', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, margin: Spacing.three, marginBottom: 0, padding: Spacing.three },
  contextCopy: { flex: 1, gap: 2, minWidth: 0 },
  contextIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  counter: { alignSelf: 'flex-end', marginHorizontal: Spacing.four, marginTop: -Spacing.two },
  error: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  filterButton: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, maxWidth: 132, minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  list: { flexGrow: 1, gap: Spacing.two, padding: Spacing.four },
  rowCopy: { gap: 3 },
  rowMeta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1, minHeight: TouchTarget, paddingHorizontal: 0 },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, marginHorizontal: Spacing.three, marginTop: Spacing.three },
  searchWrap: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  sourceNotice: { margin: Spacing.three, marginBottom: 0, padding: Spacing.three, borderRadius: Radius.large },
  tab: { alignItems: 'center', borderBottomWidth: 2, flex: 1, minHeight: TouchTarget, justifyContent: 'center' },
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  threadIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 40, justifyContent: 'center', width: 40 },
});
